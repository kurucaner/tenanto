import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { HttpStatus } from "@/packages/shared";
import {
  PropertyMemberInviteInvalidStateError,
  PropertyMemberInviteNotFoundError,
  propertyMemberInviteService,
} from "@/services/property-member-invite-service";

export const propertyInviteRoutes = async (server: FastifyInstance): Promise<void> => {
  server.get<{ Querystring: { token?: string } }>(
    "/invites/preview",
    async (request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
      const token = request.query.token?.trim();
      if (!token) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "token is required" });
      }

      try {
        const preview = await propertyMemberInviteService.previewInvite(token);
        return reply.send(preview);
      } catch (error) {
        if (
          error instanceof PropertyMemberInviteNotFoundError ||
          error instanceof PropertyMemberInviteInvalidStateError
        ) {
          return reply.status(HttpStatus.NOT_FOUND).send({ error: (error as Error).message });
        }
        throw error;
      }
    }
  );
};
