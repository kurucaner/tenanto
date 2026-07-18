import { isIdentityConflictError } from "@/constants/account";
import { isInviteSignupDomainError } from "@/errors/invite-signup-errors";
import { isPortalInviteDomainError } from "@/errors/portal-invite-errors";
import { isPropertyMemberInviteDomainError } from "@/errors/property-member-invite-errors";
import { HttpStatus } from "@/packages/shared";

export type TInviteSignupFailure = {
  body: { code?: string; error: string };
  headers?: Record<string, string>;
  status: "error";
  statusCode: number;
};

export function mapInviteSignupDomainError(
  error: unknown,
  options?: { includePropertyMemberInviteErrors?: boolean }
): TInviteSignupFailure | null {
  if (isInviteSignupDomainError(error)) {
    return {
      body: { code: error.code, error: error.message },
      status: "error",
      statusCode: error.httpStatus,
    };
  }

  if (isPortalInviteDomainError(error)) {
    return {
      body: { code: error.code, error: error.message },
      status: "error",
      statusCode: error.httpStatus,
    };
  }

  if (options?.includePropertyMemberInviteErrors && isPropertyMemberInviteDomainError(error)) {
    return {
      body: { code: error.code, error: error.message },
      status: "error",
      statusCode: error.httpStatus,
    };
  }

  if (isIdentityConflictError(error)) {
    return {
      body: { code: error.code, error: error.message },
      status: "error",
      statusCode: HttpStatus.CONFLICT,
    };
  }

  return null;
}
