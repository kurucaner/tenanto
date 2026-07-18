import { describe, expect, test } from "bun:test";

import { HttpStatus } from "@/packages/shared";

import {
  inviteSignupAccountExistsError,
  InviteSignupErrorCode,
  inviteSignupEmailMismatchError,
  inviteSignupValidationError,
  isInviteSignupDomainError,
} from "./invite-signup-errors";

describe("invite signup domain errors", () => {
  test("creates validation error with 400", () => {
    const error = inviteSignupValidationError("token is required");

    expect(error.code).toBe(InviteSignupErrorCode.VALIDATION);
    expect(error.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(isInviteSignupDomainError(error)).toBe(true);
  });

  test("creates account exists error with 409", () => {
    const error = inviteSignupAccountExistsError();

    expect(error.code).toBe(InviteSignupErrorCode.ACCOUNT_EXISTS);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });

  test("creates email mismatch error with 403", () => {
    const error = inviteSignupEmailMismatchError(
      "Google account email must match the invited email address for this property"
    );

    expect(error.code).toBe(InviteSignupErrorCode.EMAIL_MISMATCH);
    expect(error.httpStatus).toBe(HttpStatus.FORBIDDEN);
  });
});
