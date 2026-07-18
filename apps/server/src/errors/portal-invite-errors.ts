import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { HttpStatus, type ILeaseTenantMembership } from "@/packages/shared";

export const PortalInviteErrorCode = {
  DUPLICATE: "PORTAL_INVITE_DUPLICATE",
  INVALID_STATE: "PORTAL_INVITE_INVALID_STATE",
  LEASE_MISMATCH: "PORTAL_INVITE_LEASE_MISMATCH",
  NOT_FOUND: "PORTAL_INVITE_NOT_FOUND",
  TARGET: "PORTAL_INVITE_TARGET",
} as const;

export type TPortalInviteErrorCode =
  (typeof PortalInviteErrorCode)[keyof typeof PortalInviteErrorCode];

const PORTAL_INVITE_ERROR_CODES = new Set<string>(Object.values(PortalInviteErrorCode));

export function isPortalInviteDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && PORTAL_INVITE_ERROR_CODES.has(error.code);
}

export function isDuplicatePortalInviteError(error: unknown): error is DomainError {
  return isDomainError(error) && error.code === PortalInviteErrorCode.DUPLICATE;
}

export function portalInviteNotFoundError(message = "Portal invite not found"): DomainError {
  return createDomainError(PortalInviteErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
}

export function portalInviteLeaseMismatchError(
  message = "Portal invite does not belong to this lease"
): DomainError {
  return createDomainError(PortalInviteErrorCode.LEASE_MISMATCH, message, HttpStatus.NOT_FOUND);
}

export function portalInviteInvalidStateError(message: string): DomainError {
  return createDomainError(PortalInviteErrorCode.INVALID_STATE, message, HttpStatus.BAD_REQUEST);
}

export function portalInviteTargetError(message: string): DomainError {
  return createDomainError(PortalInviteErrorCode.TARGET, message, HttpStatus.BAD_REQUEST);
}

export function duplicatePortalInviteError(membership: ILeaseTenantMembership): DomainError {
  return createDomainError(
    PortalInviteErrorCode.DUPLICATE,
    "A pending portal invite already exists for this lease occupant",
    HttpStatus.CONFLICT,
    { membershipId: membership.id }
  );
}
