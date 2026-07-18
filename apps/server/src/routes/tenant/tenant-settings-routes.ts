import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { HttpStatus, type ITenantSmsOptOutResponse } from "@/packages/shared";
import { optOutTenantSms } from "@/services/tenant-sms-settings-service";

export const tenantSettingsRoutes = async (server: FastifyInstance): Promise<void> => {
  const tenantAuthPre = { preHandler: server.authenticateTenant.bind(server) };

  server.post(
    "/tenant/me/sms/opt-out",
    tenantAuthPre,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }

      const result = await optOutTenantSms(tenantUserId);
      if (result.status === "error") {
        return reply.status(result.statusCode).send(result.body);
      }

      const response: ITenantSmsOptOutResponse = { user: result.user };
      return reply.send(response);
    }
  );
};
