import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import {
  getLeaseTermsEditBlockMessage,
  HttpStatus,
  type TLeaseTermsEditBlockReason,
  type TTenantMembershipStatus,
} from "@/packages/shared";

export const LeaseErrorCode = {
  ACTIVE_LONG_STAY_CONFLICT: "ACTIVE_LONG_STAY_CONFLICT",
  INVALID_EXTEND_LEASE: "INVALID_EXTEND_LEASE",
  INVALID_TENANT_MEMBERSHIP_TRANSITION: "TENANT_MEMBERSHIP_INVALID_TRANSITION",
  LEASE_TERMS_NOT_EDITABLE: "LEASE_TERMS_NOT_EDITABLE",
  LEASE_TERMS_VALIDATION: "LEASE_TERMS_VALIDATION",
  LINKED_TENANT_CONTACT: "LINKED_TENANT_CONTACT",
  LONG_STAY_NOT_ACTIVE: "LONG_STAY_NOT_ACTIVE",
  LONG_STAY_NOT_FOUND: "LONG_STAY_NOT_FOUND",
  MAX_SECONDARY_OCCUPANTS: "MAX_SECONDARY_OCCUPANTS",
  SECONDARY_OCCUPANT_LEASE_MISMATCH: "SECONDARY_OCCUPANT_LEASE_MISMATCH",
  SECONDARY_OCCUPANT_NOT_FOUND: "SECONDARY_OCCUPANT_NOT_FOUND",
  TENANT_LEASE_ACCESS_DENIED: "TENANT_LEASE_ACCESS_DENIED",
  TENANT_MEMBERSHIP_NOT_FOUND: "TENANT_MEMBERSHIP_NOT_FOUND",
} as const;

export type TLeaseErrorCode = (typeof LeaseErrorCode)[keyof typeof LeaseErrorCode];

const LEASE_ERROR_CODES = new Set<string>(Object.values(LeaseErrorCode));

export function isLeaseDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && LEASE_ERROR_CODES.has(error.code);
}

export function activeLongStayConflictError(
  message = "Unit already has an active lease"
): DomainError {
  return createDomainError(LeaseErrorCode.ACTIVE_LONG_STAY_CONFLICT, message, HttpStatus.CONFLICT);
}

export function longStayNotFoundError(message = "Long stay not found"): DomainError {
  return createDomainError(LeaseErrorCode.LONG_STAY_NOT_FOUND, message, HttpStatus.NOT_FOUND);
}

export function longStayNotActiveError(message = "Long stay is not active"): DomainError {
  return createDomainError(LeaseErrorCode.LONG_STAY_NOT_ACTIVE, message, HttpStatus.BAD_REQUEST);
}

export function invalidExtendLeaseError(message: string): DomainError {
  return createDomainError(LeaseErrorCode.INVALID_EXTEND_LEASE, message, HttpStatus.BAD_REQUEST);
}

export function leaseTermsNotEditableError(reason: TLeaseTermsEditBlockReason): DomainError {
  return createDomainError(
    LeaseErrorCode.LEASE_TERMS_NOT_EDITABLE,
    getLeaseTermsEditBlockMessage(reason),
    HttpStatus.CONFLICT,
    { reason }
  );
}

export function leaseTermsValidationError(message: string): DomainError {
  return createDomainError(LeaseErrorCode.LEASE_TERMS_VALIDATION, message, HttpStatus.BAD_REQUEST);
}

export function linkedTenantContactError(message: string): DomainError {
  return createDomainError(LeaseErrorCode.LINKED_TENANT_CONTACT, message, HttpStatus.CONFLICT);
}

export function maxSecondaryOccupantsError(max: number): DomainError {
  return createDomainError(
    LeaseErrorCode.MAX_SECONDARY_OCCUPANTS,
    `A lease can have at most ${max} secondary occupants`,
    HttpStatus.CONFLICT,
    { max }
  );
}

export function secondaryOccupantNotFoundError(
  message = "Secondary occupant not found"
): DomainError {
  return createDomainError(
    LeaseErrorCode.SECONDARY_OCCUPANT_NOT_FOUND,
    message,
    HttpStatus.NOT_FOUND
  );
}

export function secondaryOccupantLeaseMismatchError(
  message = "Secondary occupant does not belong to this lease"
): DomainError {
  return createDomainError(
    LeaseErrorCode.SECONDARY_OCCUPANT_LEASE_MISMATCH,
    message,
    HttpStatus.NOT_FOUND
  );
}

export function invalidTenantMembershipTransitionError(
  from: TTenantMembershipStatus,
  to: TTenantMembershipStatus
): DomainError {
  return createDomainError(
    LeaseErrorCode.INVALID_TENANT_MEMBERSHIP_TRANSITION,
    `Invalid tenant membership transition: ${from} → ${to}`,
    HttpStatus.BAD_REQUEST,
    { from, to }
  );
}

export function tenantLeaseAccessDeniedError(message = "Access denied"): DomainError {
  return createDomainError(LeaseErrorCode.TENANT_LEASE_ACCESS_DENIED, message, HttpStatus.FORBIDDEN);
}

export function tenantMembershipNotFoundError(message = "Portal invite not found"): DomainError {
  return createDomainError(
    LeaseErrorCode.TENANT_MEMBERSHIP_NOT_FOUND,
    message,
    HttpStatus.NOT_FOUND
  );
}
