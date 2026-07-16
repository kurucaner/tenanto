import type { FastifyInstance, FastifyReply } from "fastify";

import { HttpStatus, type ITenantCreateRentCheckoutBody } from "@/packages/shared";
import { StripeConnectNotConfiguredError } from "@/services/property-stripe-connect-service";
import { TenantLeaseAccessDeniedError } from "@/services/tenant-portal-access";
import {
  RentPaymentConnectNotReadyError,
  RentPaymentNotFoundError,
  RentPaymentValidationError,
  tenantRentPaymentService,
} from "@/services/tenant-rent-payment-service";
import { WinstonLogger } from "@/services/winston";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRentPaymentError(error: unknown, reply: FastifyReply): FastifyReply | null {
  if (error instanceof TenantLeaseAccessDeniedError) {
    return reply.status(HttpStatus.FORBIDDEN).send({ error: error.message });
  }
  if (error instanceof RentPaymentValidationError) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
  }
  if (error instanceof RentPaymentConnectNotReadyError) {
    return reply.status(HttpStatus.CONFLICT).send({ error: error.message });
  }
  if (error instanceof RentPaymentNotFoundError) {
    return reply.status(HttpStatus.NOT_FOUND).send({ error: error.message });
  }
  if (error instanceof StripeConnectNotConfiguredError) {
    return reply.status(HttpStatus.SERVICE_UNAVAILABLE).send({ error: error.message });
  }
  return null;
}

function parseCheckoutBody(raw: unknown): ITenantCreateRentCheckoutBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.leaseId !== "string" || !body.leaseId.trim()) return null;
  if (typeof body.amountCents !== "number" || !Number.isInteger(body.amountCents)) return null;
  if (!Array.isArray(body.periodMonths) || !body.periodMonths.every((m) => typeof m === "string")) {
    return null;
  }
  return {
    amountCents: body.amountCents,
    leaseId: body.leaseId.trim(),
    periodMonths: body.periodMonths as string[],
  };
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

  server.post<{ Params: { leaseId: string } }>(
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

      const body = parseCheckoutBody(request.body);
      if (!body) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: "amountCents (integer), leaseId, and periodMonths[] are required",
        });
      }

      try {
        const result = await tenantRentPaymentService.createCheckout(leaseId, tenantUserId, body);
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
