import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { HttpStatus, type TPropertyInviteStatus } from "@/packages/shared";

export const PropertyMemberInviteErrorCode = {
  ALREADY_MEMBER: "PROPERTY_MEMBER_ALREADY_MEMBER",
  DUPLICATE: "PROPERTY_MEMBER_INVITE_DUPLICATE",
  INVALID_STATE: "PROPERTY_MEMBER_INVITE_INVALID_STATE",
  INVALID_TRANSITION: "PROPERTY_MEMBER_INVITE_INVALID_TRANSITION",
  MISMATCH: "PROPERTY_MEMBER_INVITE_MISMATCH",
  NOT_FOUND: "PROPERTY_MEMBER_INVITE_NOT_FOUND",
} as const;

export type TPropertyMemberInviteErrorCode =
  (typeof PropertyMemberInviteErrorCode)[keyof typeof PropertyMemberInviteErrorCode];

const PROPERTY_MEMBER_INVITE_ERROR_CODES = new Set<string>(
  Object.values(PropertyMemberInviteErrorCode)
);

export function isPropertyMemberInviteDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && PROPERTY_MEMBER_INVITE_ERROR_CODES.has(error.code);
}

export function isDuplicatePropertyMemberInviteError(error: unknown): error is DomainError {
  return isDomainError(error) && error.code === PropertyMemberInviteErrorCode.DUPLICATE;
}

export function propertyMemberInviteNotFoundError(
  message = "Property member invite not found"
): DomainError {
  return createDomainError(PropertyMemberInviteErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
}

export function propertyMemberInviteMismatchError(
  message = "Property member invite does not belong to this property"
): DomainError {
  return createDomainError(PropertyMemberInviteErrorCode.MISMATCH, message, HttpStatus.NOT_FOUND);
}

export function propertyMemberInviteInvalidStateError(message: string): DomainError {
  return createDomainError(
    PropertyMemberInviteErrorCode.INVALID_STATE,
    message,
    HttpStatus.BAD_REQUEST
  );
}

export function propertyMemberAlreadyMemberError(
  message = "User is already a member of this property"
): DomainError {
  return createDomainError(
    PropertyMemberInviteErrorCode.ALREADY_MEMBER,
    message,
    HttpStatus.CONFLICT
  );
}

export function duplicatePropertyMemberInviteError(
  message = "A pending property member invite already exists for this email"
): DomainError {
  return createDomainError(PropertyMemberInviteErrorCode.DUPLICATE, message, HttpStatus.CONFLICT);
}

export function invalidPropertyMemberInviteTransitionError(
  from: TPropertyInviteStatus,
  to: TPropertyInviteStatus
): DomainError {
  return createDomainError(
    PropertyMemberInviteErrorCode.INVALID_TRANSITION,
    `Invalid property member invite transition from ${from} to ${to}`,
    HttpStatus.BAD_REQUEST,
    { from, to }
  );
}
