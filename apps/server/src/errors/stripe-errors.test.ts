import { describe, expect, test } from "bun:test";

import { HttpStatus } from "@/packages/shared";

import {
  stripeConnectNotConfiguredError,
  StripeErrorCode,
  stripeWebhookSignatureError,
} from "./stripe-errors";

describe("stripe domain errors", () => {
  test("stripeConnectNotConfiguredError uses 503", () => {
    const error = stripeConnectNotConfiguredError();

    expect(error.code).toBe(StripeErrorCode.CONNECT_NOT_CONFIGURED);
    expect(error.httpStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  test("stripeWebhookSignatureError uses 400", () => {
    expect(stripeWebhookSignatureError("Invalid signature").httpStatus).toBe(
      HttpStatus.BAD_REQUEST
    );
  });
});
