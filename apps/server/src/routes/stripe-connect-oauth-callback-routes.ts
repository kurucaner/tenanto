import type { FastifyInstance } from "fastify";

import { isStripeConnectStandardOAuthEnabled } from "@/lib/stripe-connect-config";
import { HttpStatus } from "@/packages/shared";
import { propertyStripeConnectService } from "@/services/property-stripe-connect-service";
import { WinstonLogger } from "@/services/winston";

export async function stripeConnectOAuthCallbackRoutes(server: FastifyInstance): Promise<void> {
  server.get<{
    Querystring: {
      code?: string;
      error?: string;
      error_description?: string;
      state?: string;
    };
  }>("/stripe/connect/oauth/callback", async (request, reply) => {
    if (!isStripeConnectStandardOAuthEnabled()) {
      return reply.status(HttpStatus.NOT_FOUND).send({ error: "Not found" });
    }

    try {
      const result = await propertyStripeConnectService.completeStandardOAuthCallback({
        code: request.query.code,
        error: request.query.error,
        state: request.query.state,
      });
      return reply.redirect(result.redirectUrl, 302);
    } catch (error) {
      WinstonLogger.error({
        err: error,
        msg: "tenant_payments.connect_oauth_callback_failed",
      });
      return reply
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ error: "OAuth callback failed" });
    }
  });
}
