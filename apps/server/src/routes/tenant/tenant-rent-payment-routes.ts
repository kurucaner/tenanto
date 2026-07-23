import type { FastifyInstance, FastifyReply } from "fastify";

import {
  HttpStatus,
  type ITenantCreateRentCheckoutBody,
  type ITenantCreateRentPaymentIntentBody,
} from "@/packages/shared";
import { replyFromDomainError } from "@/routes/reply-from-domain-error";
import { tenantRentPaymentService } from "@/services/tenant-rent-payment-service";
import { WinstonLogger } from "@/services/winston";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRentPaymentError(error: unknown, reply: FastifyReply): FastifyReply | null {
  if (replyFromDomainError(reply, error)) {
    return reply;
  }
  return null;
}

export const tenantRentPaymentRoutes = async (server: FastifyInstance): Promise<void> => {
  const tenantAuthPre = { preHandler: server.authenticateTenant.bind(server) };

  server.get("/tenant/me/rent-summary", tenantAuthPre, async (request, reply) => {
    const tenantUserId = request.tenantUser?.tenantUserId;
    if (!tenantUserId) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
    }

    try {
      const summary = await tenantRentPaymentService.getRentSummary(tenantUserId);
      return reply.status(HttpStatus.OK).send(summary);
    } catch (error) {
      const mapped = mapRentPaymentError(error, reply);
      if (mapped) return mapped;
      throw error;
    }
  });

  server.get<{ Params: { leaseId: string } }>(
    "/tenant/me/leases/:leaseId/balance",
    tenantAuthPre,
    async (request, reply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }
      const { leaseId } = request.params;
      if (!UUID_RE.test(leaseId)) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid leaseId" });
      }

      try {
        const balance = await tenantRentPaymentService.getBalance(leaseId, tenantUserId);
        return reply.status(HttpStatus.OK).send(balance);
      } catch (error) {
        const mapped = mapRentPaymentError(error, reply);
        if (mapped) return mapped;
        throw error;
      }
    }
  );

  server.post<{ Body: ITenantCreateRentCheckoutBody; Params: { leaseId: string } }>(
    "/tenant/me/leases/:leaseId/rent-payments/checkout",
    tenantAuthPre,
    async (request, reply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }
      const { leaseId } = request.params;
      if (!UUID_RE.test(leaseId)) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid leaseId" });
      }

      try {
        const result = await tenantRentPaymentService.createCheckout(
          leaseId,
          tenantUserId,
          request.body ?? ({} as ITenantCreateRentCheckoutBody)
        );
        return reply.status(HttpStatus.CREATED).send(result);
      } catch (error) {
        const mapped = mapRentPaymentError(error, reply);
        if (mapped) return mapped;
        WinstonLogger.error({
          err: error,
          leaseId,
          msg: "tenant_payments.checkout_failed",
          tenantUserId,
        });
        return reply
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send({ error: "Failed to create rent checkout" });
      }
    }
  );

  server.post<{ Body: ITenantCreateRentPaymentIntentBody; Params: { leaseId: string } }>(
    "/tenant/me/leases/:leaseId/rent-payments/payment-intent",
    tenantAuthPre,
    async (request, reply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }
      const { leaseId } = request.params;
      if (!UUID_RE.test(leaseId)) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid leaseId" });
      }

      try {
        const result = await tenantRentPaymentService.createPaymentIntent(
          leaseId,
          tenantUserId,
          request.body ?? ({} as ITenantCreateRentPaymentIntentBody)
        );
        return reply.status(HttpStatus.CREATED).send(result);
      } catch (error) {
        const mapped = mapRentPaymentError(error, reply);
        if (mapped) return mapped;
        WinstonLogger.error({
          err: error,
          leaseId,
          msg: "tenant_payments.payment_intent_failed",
          tenantUserId,
        });
        return reply
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send({ error: "Failed to create rent payment intent" });
      }
    }
  );

  server.get<{ Params: { paymentId: string } }>(
    "/tenant/me/rent-payments/:paymentId",
    tenantAuthPre,
    async (request, reply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }
      const { paymentId } = request.params;
      if (!UUID_RE.test(paymentId)) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid paymentId" });
      }

      try {
        const status = await tenantRentPaymentService.getPaymentStatus(paymentId, tenantUserId);
        return reply.status(HttpStatus.OK).send(status);
      } catch (error) {
        const mapped = mapRentPaymentError(error, reply);
        if (mapped) return mapped;
        throw error;
      }
    }
  );
};
