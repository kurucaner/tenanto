import { describe, expect, test } from "bun:test";

import { HttpStatus, PropertyInviteStatus } from "@/packages/shared";

import {
  duplicatePropertyMemberInviteError,
  invalidPropertyMemberInviteTransitionError,
  isDuplicatePropertyMemberInviteError,
  isPropertyMemberInviteDomainError,
  PropertyMemberInviteErrorCode,
  propertyMemberInviteInvalidStateError,
  propertyMemberInviteNotFoundError,
} from "./property-member-invite-errors";

describe("property member invite domain errors", () => {
  test("creates coded errors with expected http status", () => {
    const error = propertyMemberInviteNotFoundError("Property not found");

    expect(error.code).toBe(PropertyMemberInviteErrorCode.NOT_FOUND);
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(error.message).toBe("Property not found");
    expect(isPropertyMemberInviteDomainError(error)).toBe(true);
  });

  test("invalidPropertyMemberInviteTransitionError includes from/to in body", () => {
    const error = invalidPropertyMemberInviteTransitionError(
      PropertyInviteStatus.PENDING_INVITE,
      PropertyInviteStatus.ACCEPTED
    );

    expect(error.code).toBe(PropertyMemberInviteErrorCode.INVALID_TRANSITION);
    expect(error.body).toEqual({
      from: PropertyInviteStatus.PENDING_INVITE,
      to: PropertyInviteStatus.ACCEPTED,
    });
  });

  test("duplicatePropertyMemberInviteError is recognized by helper", () => {
    const error = duplicatePropertyMemberInviteError();

    expect(isDuplicatePropertyMemberInviteError(error)).toBe(true);
  });

  test("isPropertyMemberInviteDomainError rejects unrelated errors", () => {
    expect(
      isPropertyMemberInviteDomainError(propertyMemberInviteInvalidStateError("Expired"))
    ).toBe(true);
    expect(isPropertyMemberInviteDomainError(new Error("boom"))).toBe(false);
  });
});
