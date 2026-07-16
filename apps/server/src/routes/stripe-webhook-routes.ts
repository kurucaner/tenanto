import type { FastifyInstance } from "fastify";

import { HttpStatus } from "@/packages/shared";
import {
  processVerifiedStripeWebhook,
  StripeWebhookSignatureError,
  verifyAndParseStripeWebhook,
} from "@/services/stripe-webhook-service";
import { WinstonLogger } from "@/services/winston";

/**
 * Encapsulated plugin: raw JSON body required for Stripe signature verification.
 */
export const stripeWebhookRoutes = async (server: FastifyInstance): Promise<void> => {
  server.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  server.post("/webhooks/stripe", async (request, reply) => {
    const rawBody = request.body;
    if (!Buffer.isBuffer(rawBody) && typeof rawBody !== "string") {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Expected raw JSON body" });
    }

    try {
      const verified = verifyAndParseStripeWebhook(rawBody, request.headers["stripe-signature"]);
      await processVerifiedStripeWebhook(verified);
      return reply.status(HttpStatus.OK).send({ received: true });
    } catch (error) {
      if (error instanceof StripeWebhookSignatureError) {
        WinstonLogger.warn({
          msg: "tenant_payments.webhook_signature_invalid",
          reason: error.message,
        });
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid signature" });
      }
      WinstonLogger.error({
        err: error,
        msg: "tenant_payments.webhook_handler_failed",
      });
      return reply
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ error: "Webhook handler failed" });
    }
  });
};
