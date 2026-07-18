import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_MAX,
  TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/tenant-portal-rate-limit-config";
import {
  HttpStatus,
  type ICreateLeasePortalInviteBody,
  type ICreateLeasePortalInvitesResponse,
  type ILeasePortalAccessResponse,
  type IResendLeasePortalInviteResponse,
  type IRevokeLeasePortalInviteResponse,
} from "@/packages/shared";
import { replyFromDomainError } from "@/routes/reply-from-domain-error";
import {
  assertTenantPortalInviteCreateAllowed,
  getTenantPortalInviteCreateRateLimitErrorMessage,
} from "@/services/tenant-portal-invite-create-rate-limit";
import { tenantPortalInviteService } from "@/services/tenant-portal-invite-service";

import { parseUuidParam } from "./admin-query-utils";
import { parseJsonObject } from "./parse-body-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";

interface IPropertyLongStayParams {
  longStayId: string;
  propertyId: string;
}

interface IPropertyLongStayPortalInviteParams extends IPropertyLongStayParams {
  membershipId: string;
}

function parseSecondaryIndexes(raw: unknown): number[] | null {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return null;
  }

  const indexes: number[] = [];
  for (const item of raw) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 0) {
      return null;
    }
    indexes.push(item);
  }
  return indexes;
}

function parseSecondaryMembershipIds(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return null;
  }

  const membershipIds: string[] = [];
  for (const item of raw) {
    const parsed = parseUuidParam(item);
    if (parsed === null) {
      return null;
    }
    membershipIds.push(parsed);
  }
  return membershipIds;
}

function parseCreateInviteBody(
  raw: unknown
): { body: ICreateLeasePortalInviteBody; ok: true } | { error: string; ok: false } {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const invitePrimaryRaw = parsed["invitePrimary"];
  if (invitePrimaryRaw !== undefined && typeof invitePrimaryRaw !== "boolean") {
    return { error: "invitePrimary must be a boolean", ok: false };
  }

  const secondaryMembershipIds = parseSecondaryMembershipIds(parsed["secondaryMembershipIds"]);
  if (secondaryMembershipIds === null) {
    return { error: "secondaryMembershipIds must be an array of UUIDs", ok: false };
  }

  const secondaryIndexes = parseSecondaryIndexes(parsed["secondaryIndexes"]);
  if (secondaryIndexes === null) {
    return { error: "secondaryIndexes must be an array of non-negative integers", ok: false };
  }

  return {
    body: {
      invitePrimary: invitePrimaryRaw === true ? true : undefined,
      secondaryIndexes,
      secondaryMembershipIds,
    },
    ok: true,
  };
}

function handlePortalInviteError(error: unknown, reply: FastifyReply): FastifyReply {
  if (replyFromDomainError(reply, error)) {
    return reply;
  }
  throw error;
}

export const propertyLongStayPortalRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyLongStayParams }>(
    "/properties/:propertyId/long-stays/:longStayId/portal-access",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyLongStayParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) {
        return;
      }

      try {
        const memberships = await tenantPortalInviteService.listPortalAccess(
          longStayId,
          propertyId
        );
        const response: ILeasePortalAccessResponse = { memberships };
        return reply.send(response);
      } catch (error) {
        return handlePortalInviteError(error, reply);
      }
    }
  );

  server.post<{ Body: unknown; Params: IPropertyLongStayParams }>(
    "/properties/:propertyId/long-stays/:longStayId/portal-invites",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Body: unknown; Params: IPropertyLongStayParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }

      const hasAccess = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) {
        return;
      }

      const rateLimit = await assertTenantPortalInviteCreateAllowed(longStayId);
      if (!rateLimit.allowed) {
        return reply
          .status(HttpStatus.TOO_MANY_REQUESTS)
          .header("Retry-After", String(rateLimit.retryAfterSec))
          .send({
            error: getTenantPortalInviteCreateRateLimitErrorMessage({
              limit: TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_MAX,
              retryAfterSec: rateLimit.retryAfterSec,
              windowMs: TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_WINDOW_MS,
            }),
          });
      }

      const parsed = parseCreateInviteBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      try {
        const results = await tenantPortalInviteService.createInvites({
          invitedBy: request.user.userId,
          invitePrimary: parsed.body.invitePrimary,
          leaseId: longStayId,
          propertyId,
          secondaryIndexes: parsed.body.secondaryIndexes,
          secondaryMembershipIds: parsed.body.secondaryMembershipIds,
        });
        const response: ICreateLeasePortalInvitesResponse = { results };
        return reply.status(HttpStatus.CREATED).send(response);
      } catch (error) {
        return handlePortalInviteError(error, reply);
      }
    }
  );

  server.post<{ Params: IPropertyLongStayPortalInviteParams }>(
    "/properties/:propertyId/long-stays/:longStayId/portal-invites/:membershipId/resend",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyLongStayPortalInviteParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }

      const membershipId = parseUuidParam(request.params.membershipId);
      if (membershipId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid membershipId" });
      }

      const hasAccess = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) {
        return;
      }

      try {
        const result = await tenantPortalInviteService.resendInvite({
          leaseId: longStayId,
          membershipId,
          propertyId,
        });
        const response: IResendLeasePortalInviteResponse = result;
        return reply.send(response);
      } catch (error) {
        return handlePortalInviteError(error, reply);
      }
    }
  );

  server.post<{ Params: IPropertyLongStayPortalInviteParams }>(
    "/properties/:propertyId/long-stays/:longStayId/portal-invites/:membershipId/revoke",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyLongStayPortalInviteParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }

      const membershipId = parseUuidParam(request.params.membershipId);
      if (membershipId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid membershipId" });
      }

      const hasAccess = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) {
        return;
      }

      try {
        const membership = await tenantPortalInviteService.revokeInvite({
          leaseId: longStayId,
          membershipId,
          propertyId,
        });
        const response: IRevokeLeasePortalInviteResponse = { membership };
        return reply.send(response);
      } catch (error) {
        return handlePortalInviteError(error, reply);
      }
    }
  );
};
