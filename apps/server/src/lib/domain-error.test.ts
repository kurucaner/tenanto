import { describe, expect, test } from "bun:test";

import { HttpStatus } from "@/packages/shared";

import { createDomainError, DomainError, isDomainError } from "./domain-error";

describe("DomainError", () => {
  test("preserves code, message, httpStatus, and optional body", () => {
    const error = new DomainError(
      "PORTAL_INVITE_NOT_FOUND",
      "Portal invite not found",
      HttpStatus.NOT_FOUND,
      { membershipId: "membership-1" }
    );

    expect(error.code).toBe("PORTAL_INVITE_NOT_FOUND");
    expect(error.message).toBe("Portal invite not found");
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(error.body).toEqual({ membershipId: "membership-1" });
    expect(error.name).toBe("DomainError");
  });

  test("createDomainError returns a DomainError instance", () => {
    const error = createDomainError(
      "PROPERTY_MEMBER_INVITE_MISMATCH",
      "Property member invite does not belong to this property",
      HttpStatus.NOT_FOUND
    );

    expect(isDomainError(error)).toBe(true);
  });

  test("isDomainError returns false for generic errors", () => {
    expect(isDomainError(new Error("boom"))).toBe(false);
    expect(isDomainError(null)).toBe(false);
  });
});
