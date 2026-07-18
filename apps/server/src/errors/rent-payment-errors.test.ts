import { describe, expect, test } from "bun:test";

import { HttpStatus } from "@/packages/shared";

import {
  rentPaymentConnectNotReadyError,
  RentPaymentErrorCode,
  rentPaymentNotFoundError,
} from "./rent-payment-errors";

describe("rent payment domain errors", () => {
  test("rentPaymentConnectNotReadyError uses 409", () => {
    expect(rentPaymentConnectNotReadyError().httpStatus).toBe(HttpStatus.CONFLICT);
  });

  test("rentPaymentNotFoundError uses 404", () => {
    const error = rentPaymentNotFoundError();

    expect(error.code).toBe(RentPaymentErrorCode.NOT_FOUND);
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
  });
});
