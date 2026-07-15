import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { type TenantJwtPayload } from "@/auth/tenant-jwt";
import {
  HttpStatus,
  type ITenantInviteRedeemBody,
  type ITenantInviteRedeemResponse,
  type ITenantLeasesListResponse,
  type ITenantMembershipActionResponse,
  type ITenantMeResponse,
  type ITenantPendingInvitesResponse,
} from "@/packages/shared";
import { parseUuidParam } from "@/routes/notification-query-utils";
import {
  PortalInviteInvalidStateError,
  PortalInviteNotFoundError,
  tenantPortalInviteService,
} from "@/services/tenant-portal-invite-service";
import {
  TenantMembershipNotFoundError,
  tenantPortalMembershipService,
} from "@/services/tenant-portal-membership-service";

function parseRedeemBody(body: unknown): ITenantInviteRedeemBody | null {
  if (body == null || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const token = record.token;
  if (typeof token !== "string" || token.trim() === "") {
    return null;
  }

  const email = typeof record.email === "string" ? record.email : undefined;
  const password = typeof record.password === "string" ? record.password : undefined;

  return {
    email,
    password,
    token: token.trim(),
  };
}

function mapMembershipError(error: unknown, reply: FastifyReply): FastifyReply | null {
  if (
    error instanceof PortalInviteNotFoundError ||
    error instanceof TenantMembershipNotFoundError
  ) {
    return reply.status(HttpStatus.NOT_FOUND).send({ error: (error as Error).message });
  }

  if (error instanceof PortalInviteInvalidStateError) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
  }

  return null;
}

/** Tenant portal lease routes: profile, invites, leases, and redemption. */
export const tenantLeaseRoutes = async (server: FastifyInstance): Promise<void> => {
  const tenantAuthPre = { preHandler: server.authenticateTenant.bind(server) };

  server.get("/tenant/me", tenantAuthPre, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantUserId = request.tenantUser?.tenantUserId;
    if (!tenantUserId) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
    }

    const user = await tenantPortalMembershipService.getProfile(tenantUserId);
    if (!user) {
      return reply.status(HttpStatus.NOT_FOUND).send({ error: "Tenant account not found" });
    }

    const response: ITenantMeResponse = { user };
    return reply.send(response);
  });

  server.get(
    "/tenant/me/invites/pending",
    tenantAuthPre,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }

      const invites = await tenantPortalMembershipService.listPendingInvites(tenantUserId);
      const response: ITenantPendingInvitesResponse = { invites };
      return reply.send(response);
    }
  );

  server.post<{ Params: { membershipId: string } }>(
    "/tenant/me/invites/:membershipId/accept",
    tenantAuthPre,
    async (request: FastifyRequest<{ Params: { membershipId: string } }>, reply: FastifyReply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }

      const membershipId = parseUuidParam(request.params.membershipId);
      if (membershipId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid membershipId" });
      }

      const user = await tenantPortalMembershipService.getProfile(tenantUserId);
      if (!user) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Tenant account not found" });
      }

      try {
        const membership = await tenantPortalMembershipService.acceptInvite(membershipId, user);
        const response: ITenantMembershipActionResponse = { membership };
        return reply.send(response);
      } catch (error) {
        const mapped = mapMembershipError(error, reply);
        if (mapped) return mapped;
        throw error;
      }
    }
  );

  server.post<{ Params: { membershipId: string } }>(
    "/tenant/me/invites/:membershipId/decline",
    tenantAuthPre,
    async (request: FastifyRequest<{ Params: { membershipId: string } }>, reply: FastifyReply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }

      const membershipId = parseUuidParam(request.params.membershipId);
      if (membershipId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid membershipId" });
      }

      const user = await tenantPortalMembershipService.getProfile(tenantUserId);
      if (!user) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Tenant account not found" });
      }

      try {
        const membership = await tenantPortalMembershipService.declineInvite(membershipId, user);
        const response: ITenantMembershipActionResponse = { membership };
        return reply.send(response);
      } catch (error) {
        const mapped = mapMembershipError(error, reply);
        if (mapped) return mapped;
        throw error;
      }
    }
  );

  server.get(
    "/tenant/me/leases",
    tenantAuthPre,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }

      const leases = await tenantPortalMembershipService.listActiveLeases(tenantUserId);
      const response: ITenantLeasesListResponse = { leases };
      return reply.send(response);
    }
  );

  server.get<{ Querystring: { token?: string } }>(
    "/tenant/invites/preview",
    async (request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
      const token = request.query.token?.trim();
      if (!token) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "token is required" });
      }

      try {
        const preview = await tenantPortalInviteService.previewInvite(token);
        return reply.send(preview);
      } catch (error) {
        if (
          error instanceof PortalInviteNotFoundError ||
          error instanceof PortalInviteInvalidStateError
        ) {
          return reply.status(HttpStatus.NOT_FOUND).send({ error: (error as Error).message });
        }
        throw error;
      }
    }
  );

  server.post("/tenant/invites/redeem", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseRedeemBody(request.body);
    if (!body) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "token is required" });
    }

    const authResult = await tenantPortalMembershipService.resolveTenantUserForRedeem(server, {
      authorizationHeader: request.headers.authorization,
      email: body.email,
      jwtVerify: () => request.jwtVerify<TenantJwtPayload>(),
      password: body.password,
    });

    if (!authResult) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({
        error: "Authentication required. Sign in or provide email and password.",
      });
    }

    try {
      const membership = await tenantPortalMembershipService.redeemInvite(
        body.token,
        authResult.user
      );
      const response: ITenantInviteRedeemResponse = {
        membership,
        ...(authResult.session ? { session: authResult.session } : {}),
      };
      return reply.send(response);
    } catch (error) {
      const mapped = mapMembershipError(error, reply);
      if (mapped) return mapped;
      throw error;
    }
  });
};
