import { describe, expect, test } from "bun:test";

import { HttpStatus } from "@/packages/shared";

import {
  AuthOtpErrorCode,
  otpAlreadySendingError,
  otpCooldownActiveError,
} from "./auth-otp-errors";

describe("auth otp domain errors", () => {
  test("otpAlreadySendingError uses 429", () => {
    const error = otpAlreadySendingError();

    expect(error.code).toBe(AuthOtpErrorCode.ALREADY_SENDING);
    expect(error.httpStatus).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  test("otpCooldownActiveError uses 429", () => {
    expect(otpCooldownActiveError().httpStatus).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});
