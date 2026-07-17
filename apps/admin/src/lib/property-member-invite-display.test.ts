import { describe, expect, test } from "bun:test";

import { PropertyInviteStatus, PropertyRole } from "@/packages/shared";

import {
  formatPropertyMemberInviteAdminStatus,
  getPropertyMemberInviteRowState,
  getPropertyMemberInviteStatusTone,
} from "./property-member-invite-display";

const invite = {
  acceptedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  declinedAt: null,
  email: "invitee@example.com",
  emailError: null,
  expiresAt: "2026-02-01T00:00:00.000Z",
  id: "invite-1",
  invitedAt: "2026-01-01T00:00:00.000Z",
  invitedBy: "operator-1",
  propertyId: "property-1",
  revokedAt: null,
  role: PropertyRole.MANAGER,
  status: PropertyInviteStatus.PENDING_INVITE,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("formatPropertyMemberInviteAdminStatus", () => {
  test("maps pending statuses to Pending", () => {
    expect(formatPropertyMemberInviteAdminStatus(PropertyInviteStatus.PENDING)).toBe("Pending");
    expect(formatPropertyMemberInviteAdminStatus(PropertyInviteStatus.PENDING_INVITE)).toBe(
      "Pending"
    );
    expect(formatPropertyMemberInviteAdminStatus(PropertyInviteStatus.PENDING_ACCEPTANCE)).toBe(
      "Pending"
    );
  });

  test("maps email_failed to Email failed", () => {
    expect(formatPropertyMemberInviteAdminStatus(PropertyInviteStatus.EMAIL_FAILED)).toBe(
      "Email failed"
    );
  });
});

describe("getPropertyMemberInviteStatusTone", () => {
  test("maps labels to tones", () => {
    expect(getPropertyMemberInviteStatusTone("Pending")).toBe("pending");
    expect(getPropertyMemberInviteStatusTone("Email failed")).toBe("warning");
    expect(getPropertyMemberInviteStatusTone("Declined")).toBe("muted");
  });
});

describe("getPropertyMemberInviteRowState", () => {
  test("returns pending label and tone for pending invite", () => {
    const state = getPropertyMemberInviteRowState(invite);
    expect(state.statusLabel).toBe("Pending");
    expect(state.statusTone).toBe("pending");
  });
});
