import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { isAuthorizedInternalRequest } from "@/lib/internal-webhook-auth";
import { HttpStatus } from "@/packages/shared";
import { handleTenantInboundSms } from "@/services/tenant-inbound-sms-service";
import { parseSmsInboundWebhookBody } from "@/sns/sms-inbound-utils";

export const smsInboundWebhookRoutes = async (server: FastifyInstance): Promise<void> => {
  server.post("/webhooks/sms/inbound", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAuthorizedInternalRequest(request)) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
    }

    const message = parseSmsInboundWebhookBody(request.body);
    if (message == null) {
      request.log.warn({ body: request.body }, "Ignored invalid inbound SMS payload");
      return reply.status(HttpStatus.OK).send({ ok: true, skipped: true });
    }

    const result = await handleTenantInboundSms({
      message,
      payload: request.body,
    });

    if (result == null) {
      return reply.status(HttpStatus.NOT_FOUND).send({ error: "Not found" });
    }

    return reply.send({ action: result.action, keyword: result.keyword, ok: true });
  });
};
