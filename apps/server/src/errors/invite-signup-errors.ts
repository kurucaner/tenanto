import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { HttpStatus } from "@/packages/shared";

export const InviteSignupErrorCode = {
  ACCOUNT_EXISTS: "INVITE_SIGNUP_ACCOUNT_EXISTS",
  EMAIL_MISMATCH: "INVITE_SIGNUP_EMAIL_MISMATCH",
  VALIDATION: "INVITE_SIGNUP_VALIDATION",
} as const;

export type TInviteSignupErrorCode =
  (typeof InviteSignupErrorCode)[keyof typeof InviteSignupErrorCode];

const INVITE_SIGNUP_ERROR_CODES = new Set<string>(Object.values(InviteSignupErrorCode));

export function isInviteSignupDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && INVITE_SIGNUP_ERROR_CODES.has(error.code);
}

export function inviteSignupValidationError(message: string): DomainError {
  return createDomainError(InviteSignupErrorCode.VALIDATION, message, HttpStatus.BAD_REQUEST);
}

export function inviteSignupAccountExistsError(
  message = "Account already exists. Sign in to accept."
): DomainError {
  return createDomainError(InviteSignupErrorCode.ACCOUNT_EXISTS, message, HttpStatus.CONFLICT);
}

export function inviteSignupEmailMismatchError(
  message = "Google account email must match the invited email address"
): DomainError {
  return createDomainError(InviteSignupErrorCode.EMAIL_MISMATCH, message, HttpStatus.FORBIDDEN);
}
