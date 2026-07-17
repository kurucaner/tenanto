import type { FastifyInstance } from "fastify";

import { StripeConnectNotConfiguredError } from "@/lib/stripe-connect-config";
import { HttpStatus } from "@/packages/shared";
import {
  assertPropertyMemberAccess,
  assertPropertyStructureAccess,
} from "@/routes/admin/property-route-access";
import { propertyStripeConnectService } from "@/services/property-stripe-connect-service";
import { WinstonLogger } from "@/services/winston";

export const propertyStripeConnectRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: { propertyId: string } }>(
    "/properties/:propertyId/stripe/connect/status",
    { preHandler: authPre },
    async (request, reply) => {
      const { propertyId } = request.params;
      const userId = request.user?.userId;
      const userType = request.user?.userType;
      if (!userId || !userType) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }
      if (!(await assertPropertyMemberAccess(propertyId, userId, userType, reply))) {
        return;
      }

      const status = await propertyStripeConnectService.getStatus(propertyId);
      return reply.status(HttpStatus.OK).send(status);
    }
  );

  server.post<{
    Body: { refreshUrl?: string; returnUrl?: string };
    Params: { propertyId: string };
  }>(
    "/properties/:propertyId/stripe/connect/onboarding-link",
    { preHandler: authPre },
    async (request, reply) => {
      const { propertyId } = request.params;
      const userId = request.user?.userId;
      const userType = request.user?.userType;
      if (!userId || !userType) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }
      if (
        !(await assertPropertyStructureAccess(
          propertyId,
          userId,
          userType,
          reply,
          "Only property owners can manage Stripe Connect"
        ))
      ) {
        return;
      }

      try {
        const body = request.body ?? {};
        const result = await propertyStripeConnectService.createOnboardingLink(propertyId, {
          refreshUrl: typeof body.refreshUrl === "string" ? body.refreshUrl : undefined,
          returnUrl: typeof body.returnUrl === "string" ? body.returnUrl : undefined,
        });
        return reply.status(HttpStatus.OK).send(result);
      } catch (error) {
        if (error instanceof StripeConnectNotConfiguredError) {
          return reply.status(HttpStatus.SERVICE_UNAVAILABLE).send({ error: error.message });
        }
        WinstonLogger.error({
          err: error,
          msg: "tenant_payments.connect_onboarding_failed",
          propertyId,
        });
        return reply
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send({ error: "Failed to create Stripe Connect onboarding link" });
      }
    }
  );
};
