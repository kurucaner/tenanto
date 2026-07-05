import { AccountError } from "@/packages/shared";

const ACCOUNT_PERMANENTLY_DELETED_MESSAGE =
  "This account was permanently deleted and cannot be recovered.";

export function createIdentityConflictError(message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = AccountError.IDENTITY_CONFLICT;
  return error;
}

export function isIdentityConflictError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { code: string }).code === AccountError.IDENTITY_CONFLICT
  );
}

export function createAccountPermanentlyDeletedError(): Error & { code: string } {
  const error = new Error(ACCOUNT_PERMANENTLY_DELETED_MESSAGE) as Error & {
    code: string;
  };
  error.code = AccountError.ACCOUNT_PERMANENTLY_DELETED;
  return error;
}

export function isAccountPermanentlyDeletedError(
  error: unknown
): error is Error & { code: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { code: string }).code === AccountError.ACCOUNT_PERMANENTLY_DELETED
  );
}
