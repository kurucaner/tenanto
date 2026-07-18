/**
 * Domain errors thrown from services/DB layers and mapped to HTTP responses in routes.
 *
 * ## Error code naming
 *
 * Use `SCREAMING_SNAKE` with a domain prefix and specific reason, for example:
 *
 * - `PORTAL_INVITE_NOT_FOUND`
 * - `PORTAL_INVITE_LEASE_MISMATCH`
 * - `PROPERTY_MEMBER_INVITE_INVALID_STATE`
 * - `LONG_STAY_NOT_ACTIVE`
 *
 * Prefer reusing existing shared codes (e.g. [`AccountError`](../../packages/shared/src/account-types.ts))
 * when the failure mode matches platform account semantics.
 */

export class DomainError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly body: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    body?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.body = body;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export function createDomainError(
  code: string,
  message: string,
  httpStatus: number,
  body?: Record<string, unknown>
): DomainError {
  return new DomainError(code, message, httpStatus, body);
}
