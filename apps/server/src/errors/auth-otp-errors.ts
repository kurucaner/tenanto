import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { HttpStatus } from "@/packages/shared";

export const AuthOtpErrorCode = {
  ALREADY_SENDING: "OTP_ALREADY_SENDING",
  COOLDOWN_ACTIVE: "OTP_COOLDOWN_ACTIVE",
} as const;

export type TAuthOtpErrorCode = (typeof AuthOtpErrorCode)[keyof typeof AuthOtpErrorCode];

const AUTH_OTP_ERROR_CODES = new Set<string>(Object.values(AuthOtpErrorCode));

export function isAuthOtpDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && AUTH_OTP_ERROR_CODES.has(error.code);
}

export function isAuthOtpRateLimitError(error: unknown): error is DomainError {
  return (
    isDomainError(error) &&
    (error.code === AuthOtpErrorCode.ALREADY_SENDING ||
      error.code === AuthOtpErrorCode.COOLDOWN_ACTIVE)
  );
}

export function otpAlreadySendingError(
  message = "A verification code is already being sent. Please wait."
): DomainError {
  return createDomainError(AuthOtpErrorCode.ALREADY_SENDING, message, HttpStatus.TOO_MANY_REQUESTS);
}

export function otpCooldownActiveError(
  message = "Please wait 1 minute before requesting another code"
): DomainError {
  return createDomainError(AuthOtpErrorCode.COOLDOWN_ACTIVE, message, HttpStatus.TOO_MANY_REQUESTS);
}
