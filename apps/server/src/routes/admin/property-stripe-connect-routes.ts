import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  STRIPE_CONNECT_LINK_RATE_LIMIT_MAX,
  STRIPE_CONNECT_LINK_RATE_LIMIT_WINDOW_MS,
} from "@/lib/stripe-connect-rate-limit-config";
import { HttpStatus } from "@/packages/shared";
import {
  assertPropertyMemberAccess,
  assertPropertyStructureAccess,
} from "@/routes/admin/property-route-access";
import { replyFromDomainError } from "@/routes/reply-from-domain-error";
import {
  assertPropertyStripeConnectLinkAllowed,
  getPropertyStripeConnectRateLimitErrorMessage,
} from "@/services/property-stripe-connect-rate-limit";
import { propertyStripeConnectService } from "@/services/property-stripe-connect-service";
import { WinstonLogger } from "@/services/winston";

type TExpressOnboardingLinkBody = { refreshUrl?: string; returnUrl?: string };
type TExpressOnboardingLinkParams = { propertyId: string };
type TExpressOnboardingLinkRoute = {
  Body: TExpressOnboardingLinkBody;
  Params: TExpressOnboardingLinkParams;
};

function replyConnectRouteError(
  error: unknown,
  reply: FastifyReply,
  input: { fallbackMessage: string; logMsg: string; propertyId: string }
): void {
  if (replyFromDomainError(reply, error)) {
    return;
  }
  WinstonLogger.error({
    err: error,
    msg: input.logMsg,
    propertyId: input.propertyId,
  });
  void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: input.fallbackMessage });
}

async function enforcePropertyStripeConnectLinkRateLimit(
  reply: FastifyReply,
  input: { propertyId: string; userId: string }
): Promise<boolean> {
  const rateLimit = await assertPropertyStripeConnectLinkAllowed(input.propertyId, input.userId);
  if (rateLimit.allowed) {
    return true;
  }

  void reply
    .status(HttpStatus.TOO_MANY_REQUESTS)
    .header("Retry-After", String(rateLimit.retryAfterSec))
    .send({
      error: getPropertyStripeConnectRateLimitErrorMessage({
        limit: STRIPE_CONNECT_LINK_RATE_LIMIT_MAX,
        retryAfterSec: rateLimit.retryAfterSec,
        windowMs: STRIPE_CONNECT_LINK_RATE_LIMIT_WINDOW_MS,
      }),
    });
  return false;
}

async function handleExpressOnboardingLink(
  request: FastifyRequest<{
    Body: TExpressOnboardingLinkBody;
    Params: TExpressOnboardingLinkParams;
  }>,
  reply: FastifyReply
): Promise<void> {
  const { propertyId } = request.params;
  const userId = request.user?.userId;
  const userType = request.user?.userType;
  if (!userId || !userType) {
    void reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
    return;
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
  if (!(await enforcePropertyStripeConnectLinkRateLimit(reply, { propertyId, userId }))) {
    return;
  }

  try {
    const body = request.body ?? {};
    const result = await propertyStripeConnectService.createExpressOnboardingLink(propertyId, {
      refreshUrl: typeof body.refreshUrl === "string" ? body.refreshUrl : undefined,
      returnUrl: typeof body.returnUrl === "string" ? body.returnUrl : undefined,
    });
    void reply.status(HttpStatus.OK).send(result);
  } catch (error) {
    replyConnectRouteError(error, reply, {
      fallbackMessage: "Failed to create Stripe Connect onboarding link",
      logMsg: "tenant_payments.connect_onboarding_failed",
      propertyId,
    });
  }
}

async function handleStandardOAuthAuthorizeUrl(
  request: FastifyRequest<{ Params: TExpressOnboardingLinkParams }>,
  reply: FastifyReply
): Promise<void> {
  const { propertyId } = request.params;
  const userId = request.user?.userId;
  const userType = request.user?.userType;
  if (!userId || !userType) {
    void reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
    return;
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
  if (!(await enforcePropertyStripeConnectLinkRateLimit(reply, { propertyId, userId }))) {
    return;
  }

  try {
    const result = await propertyStripeConnectService.createStandardOAuthAuthorizeUrl(
      propertyId,
      userId
    );
    void reply.status(HttpStatus.OK).send(result);
  } catch (error) {
    replyConnectRouteError(error, reply, {
      fallbackMessage: "Failed to create Stripe Connect OAuth authorize URL",
      logMsg: "tenant_payments.connect_oauth_authorize_failed",
      propertyId,
    });
  }
}

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

  server.post<TExpressOnboardingLinkRoute>(
    "/properties/:propertyId/stripe/connect/express/onboarding-link",
    { preHandler: authPre },
    handleExpressOnboardingLink
  );

  server.post<TExpressOnboardingLinkRoute>(
    "/properties/:propertyId/stripe/connect/onboarding-link",
    { preHandler: authPre },
    handleExpressOnboardingLink
  );

  server.post<{ Params: TExpressOnboardingLinkParams }>(
    "/properties/:propertyId/stripe/connect/oauth/authorize-url",
    { preHandler: authPre },
    handleStandardOAuthAuthorizeUrl
  );
};
