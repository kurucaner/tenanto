import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { type TenantJwtPayload } from "@/auth/tenant-jwt";
import {
  HttpStatus,
  type ITenantInviteRedeemBody,
  type ITenantInviteRedeemResponse,
  type ITenantInviteRegisterBody,
  type ITenantInviteRegisterGoogleBody,
  type ITenantLeasesListResponse,
  type ITenantMembershipActionResponse,
  type ITenantMeResponse,
  type ITenantPendingInvitesResponse,
  TenantLeaseListStatus,
  type TPlatform,
  type TTenantLeaseListStatus,
} from "@/packages/shared";
import { parseUuidParam } from "@/routes/notification-query-utils";
import {
  registerTenantWithInviteGoogle,
  registerTenantWithInvitePassword,
  type TTenantInviteSignupResult,
} from "@/services/tenant-invite-signup-service";
import { TenantLeaseAccessDeniedError } from "@/services/tenant-portal-access";
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

function parseInviteRegisterBody(body: unknown): ITenantInviteRegisterBody | null {
  if (body == null || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const token = record.token;
  const name = record.name;
  const password = record.password;
  if (typeof token !== "string" || token.trim() === "") {
    return null;
  }
  if (typeof name !== "string" || typeof password !== "string") {
    return null;
  }
  return { name, password, token: token.trim() };
}

function parseInviteRegisterGoogleBody(body: unknown): ITenantInviteRegisterGoogleBody | null {
  if (body == null || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const token = record.token;
  const idToken = record.idToken;
  if (typeof token !== "string" || token.trim() === "") {
    return null;
  }
  if (typeof idToken !== "string" || idToken.trim() === "") {
    return null;
  }
  return { idToken: idToken.trim(), token: token.trim() };
}

async function sendInviteSignupResult(
  reply: FastifyReply,
  result: TTenantInviteSignupResult
): Promise<FastifyReply> {
  if (result.status === "error") {
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        reply.header(key, value);
      }
    }
    return reply.status(result.statusCode).send(result.body);
  }
  return reply.send(result.response);
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

function parseLeaseListStatus(raw: unknown): TTenantLeaseListStatus | null {
  if (raw === undefined || raw === null || raw === "") {
    return TenantLeaseListStatus.ACTIVE;
  }
  if (raw === TenantLeaseListStatus.ACTIVE || raw === TenantLeaseListStatus.ENDED) {
    return raw;
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

  server.get<{ Querystring: { status?: string } }>(
    "/tenant/me/leases",
    tenantAuthPre,
    async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }

      const status = parseLeaseListStatus(request.query.status);
      if (status === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid status" });
      }

      const leases = await tenantPortalMembershipService.listLeases(tenantUserId, status);
      const response: ITenantLeasesListResponse = { leases };
      return reply.send(response);
    }
  );

  server.get<{ Params: { leaseId: string } }>(
    "/tenant/me/leases/:leaseId",
    tenantAuthPre,
    async (request: FastifyRequest<{ Params: { leaseId: string } }>, reply: FastifyReply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }

      const leaseId = parseUuidParam(request.params.leaseId);
      if (leaseId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid leaseId" });
      }

      try {
        const lease = await tenantPortalMembershipService.getLeaseDetail(leaseId, tenantUserId);
        return reply.send(lease);
      } catch (error) {
        if (error instanceof TenantLeaseAccessDeniedError) {
          return reply.status(HttpStatus.FORBIDDEN).send({ error: error.message });
        }
        if (error instanceof TenantMembershipNotFoundError) {
          return reply.status(HttpStatus.NOT_FOUND).send({ error: error.message });
        }
        throw error;
      }
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

  server.post("/tenant/invites/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseInviteRegisterBody(request.body);
    if (!body) {
      return reply
        .status(HttpStatus.BAD_REQUEST)
        .send({ error: "token, name, and password are required" });
    }

    const result = await registerTenantWithInvitePassword(server, {
      body,
      ip: request.ip,
    });
    return sendInviteSignupResult(reply, result);
  });

  server.post(
    "/tenant/invites/register/google",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parseInviteRegisterGoogleBody(request.body);
      if (!body) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "token and idToken are required" });
      }

      const result = await registerTenantWithInviteGoogle(server, {
        body,
        ip: request.ip,
        platform: request.headers["x-platform"] as TPlatform,
      });
      return sendInviteSignupResult(reply, result);
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
