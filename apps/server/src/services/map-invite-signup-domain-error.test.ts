import { describe, expect, test } from "bun:test";

import { createIdentityConflictError } from "@/constants/account";
import {
  inviteSignupAccountExistsError,
  InviteSignupErrorCode,
  inviteSignupValidationError,
} from "@/errors/invite-signup-errors";
import { PortalInviteErrorCode, portalInviteInvalidStateError } from "@/errors/portal-invite-errors";
import {
  PropertyMemberInviteErrorCode,
  propertyMemberInviteNotFoundError,
} from "@/errors/property-member-invite-errors";
import { HttpStatus } from "@/packages/shared";

import { mapInviteSignupDomainError } from "./map-invite-signup-domain-error";

describe("mapInviteSignupDomainError", () => {
  test("maps invite signup validation error", () => {
    const result = mapInviteSignupDomainError(inviteSignupValidationError("Name is required"));

    expect(result).toEqual({
      body: { code: InviteSignupErrorCode.VALIDATION, error: "Name is required" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  test("maps portal invite domain error", () => {
    const result = mapInviteSignupDomainError(portalInviteInvalidStateError("Expired"));

    expect(result?.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(result?.body.code).toBe(PortalInviteErrorCode.INVALID_STATE);
  });

  test("maps property member invite error when enabled", () => {
    const result = mapInviteSignupDomainError(propertyMemberInviteNotFoundError(), {
      includePropertyMemberInviteErrors: true,
    });

    expect(result?.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(result?.body.code).toBe(PropertyMemberInviteErrorCode.NOT_FOUND);
  });

  test("ignores property member invite error by default", () => {
    expect(mapInviteSignupDomainError(propertyMemberInviteNotFoundError())).toBeNull();
  });

  test("maps identity conflict error", () => {
    const result = mapInviteSignupDomainError(createIdentityConflictError("Email already exists"));

    expect(result?.statusCode).toBe(HttpStatus.CONFLICT);
    expect(result?.body.code).toBeDefined();
  });

  test("returns null for unrelated errors", () => {
    expect(mapInviteSignupDomainError(inviteSignupAccountExistsError())).not.toBeNull();
    expect(mapInviteSignupDomainError(new Error("boom"))).toBeNull();
  });
});
