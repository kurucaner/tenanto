import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { HttpStatus } from "@/packages/shared";

export const StripeConnectErrorCode = {
  ALREADY_CONNECTED: "STRIPE_CONNECT_ALREADY_CONNECTED",
  NOT_CONFIGURED: "STRIPE_CONNECT_NOT_CONFIGURED",
} as const;

export type TStripeConnectErrorCode =
  (typeof StripeConnectErrorCode)[keyof typeof StripeConnectErrorCode];

const STRIPE_CONNECT_ERROR_CODES = new Set<string>(Object.values(StripeConnectErrorCode));

export function isStripeConnectDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && STRIPE_CONNECT_ERROR_CODES.has(error.code);
}

export function stripeConnectNotConfiguredError(message = "Stripe is not configured"): DomainError {
  return createDomainError(
    StripeConnectErrorCode.NOT_CONFIGURED,
    message,
    HttpStatus.SERVICE_UNAVAILABLE
  );
}

export function stripeConnectConflictError(
  message = "This property already has a Stripe account connected"
): DomainError {
  return createDomainError(StripeConnectErrorCode.ALREADY_CONNECTED, message, HttpStatus.CONFLICT);
}
