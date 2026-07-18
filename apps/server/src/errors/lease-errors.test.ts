import { describe, expect, test } from "bun:test";

import { HttpStatus, LeaseTermsEditBlockReason } from "@/packages/shared";

import {
  activeLongStayConflictError,
  leaseTermsNotEditableError,
  LeaseErrorCode,
  longStayNotFoundError,
} from "./lease-errors";

describe("lease domain errors", () => {
  test("creates long stay not found with 404", () => {
    const error = longStayNotFoundError();

    expect(error.code).toBe(LeaseErrorCode.LONG_STAY_NOT_FOUND);
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
  });

  test("leaseTermsNotEditableError includes reason in body", () => {
    const error = leaseTermsNotEditableError(LeaseTermsEditBlockReason.HAS_INCOME_LINES);

    expect(error.code).toBe(LeaseErrorCode.LEASE_TERMS_NOT_EDITABLE);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
    expect(error.body).toEqual({ reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES });
  });

  test("activeLongStayConflictError uses 409", () => {
    expect(activeLongStayConflictError().httpStatus).toBe(HttpStatus.CONFLICT);
  });
});
