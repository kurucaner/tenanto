import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { HttpStatus } from "@/packages/shared";

export const RentPaymentErrorCode = {
  CONNECT_NOT_READY: "RENT_PAYMENT_CONNECT_NOT_READY",
  NOT_FOUND: "RENT_PAYMENT_NOT_FOUND",
  VALIDATION: "RENT_PAYMENT_VALIDATION",
} as const;

export type TRentPaymentErrorCode = (typeof RentPaymentErrorCode)[keyof typeof RentPaymentErrorCode];

const RENT_PAYMENT_ERROR_CODES = new Set<string>(Object.values(RentPaymentErrorCode));

export function isRentPaymentDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && RENT_PAYMENT_ERROR_CODES.has(error.code);
}

export function rentPaymentConnectNotReadyError(
  message = "Property Stripe Connect account is not ready to accept payments"
): DomainError {
  return createDomainError(RentPaymentErrorCode.CONNECT_NOT_READY, message, HttpStatus.CONFLICT);
}

export function rentPaymentValidationError(message: string): DomainError {
  return createDomainError(RentPaymentErrorCode.VALIDATION, message, HttpStatus.BAD_REQUEST);
}

export function rentPaymentNotFoundError(message = "Payment not found"): DomainError {
  return createDomainError(RentPaymentErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
}
