import { describe, expect, test } from "bun:test";

import { HttpStatus } from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";

import {
  duplicatePortalInviteError,
  isDuplicatePortalInviteError,
  isPortalInviteDomainError,
  PortalInviteErrorCode,
  portalInviteInvalidStateError,
  portalInviteNotFoundError,
} from "./portal-invite-errors";

describe("portal invite domain errors", () => {
  test("creates coded errors with expected http status", () => {
    const error = portalInviteNotFoundError("Long stay not found");

    expect(error.code).toBe(PortalInviteErrorCode.NOT_FOUND);
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(error.message).toBe("Long stay not found");
    expect(isPortalInviteDomainError(error)).toBe(true);
  });

  test("duplicatePortalInviteError includes membership id in body", () => {
    const error = duplicatePortalInviteError({
      acceptedAt: null,
      contactPhone: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      declinedAt: null,
      displayName: "Secondary",
      endedAt: null,
      expiresAt: "2026-02-01T00:00:00.000Z",
      id: "membership-1",
      invitedAt: "2026-01-01T00:00:00.000Z",
      invitedBy: "operator-1",
      inviteEmail: "secondary@example.com",
      leaseId: "lease-1",
      revokedAt: null,
      role: TenantMembershipRole.SECONDARY,
      status: TenantMembershipStatus.PENDING_INVITE,
      tenantUserId: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(isDuplicatePortalInviteError(error)).toBe(true);
    expect(error.body).toEqual({ membershipId: "membership-1" });
  });

  test("isPortalInviteDomainError rejects unrelated errors", () => {
    expect(isPortalInviteDomainError(portalInviteInvalidStateError("Expired"))).toBe(true);
    expect(isPortalInviteDomainError(new Error("boom"))).toBe(false);
  });
});
