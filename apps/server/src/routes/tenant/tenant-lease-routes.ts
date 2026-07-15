import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { HttpStatus, type ITenantInvitePreviewResponse } from "@/packages/shared";
import {
  PortalInviteInvalidStateError,
  PortalInviteNotFoundError,
  tenantPortalInviteService,
} from "@/services/tenant-portal-invite-service";

/** Phase 1+: register `/tenant/me/*` and invite redemption handlers here. */
export const tenantLeaseRoutes = async (server: FastifyInstance): Promise<void> => {
  server.get<{ Querystring: { token?: string } }>(
    "/tenant/invites/preview",
    async (request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
      const token = request.query.token?.trim();
      if (!token) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "token is required" });
      }

      try {
        const preview = await tenantPortalInviteService.previewInvite(token);
        const response: ITenantInvitePreviewResponse = preview;
        return reply.send(response);
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
};
