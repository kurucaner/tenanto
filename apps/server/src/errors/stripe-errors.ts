import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { HttpStatus } from "@/packages/shared";

export const StripeErrorCode = {
  CONNECT_NOT_CONFIGURED: "STRIPE_CONNECT_NOT_CONFIGURED",
  WEBHOOK_SIGNATURE_INVALID: "STRIPE_WEBHOOK_SIGNATURE_INVALID",
} as const;

export type TStripeErrorCode = (typeof StripeErrorCode)[keyof typeof StripeErrorCode];

const STRIPE_ERROR_CODES = new Set<string>(Object.values(StripeErrorCode));

export function isStripeDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && STRIPE_ERROR_CODES.has(error.code);
}

export function stripeConnectNotConfiguredError(
  message = "Stripe is not configured"
): DomainError {
  return createDomainError(
    StripeErrorCode.CONNECT_NOT_CONFIGURED,
    message,
    HttpStatus.SERVICE_UNAVAILABLE
  );
}

export function stripeWebhookSignatureError(message: string): DomainError {
  return createDomainError(
    StripeErrorCode.WEBHOOK_SIGNATURE_INVALID,
    message,
    HttpStatus.BAD_REQUEST
  );
}
