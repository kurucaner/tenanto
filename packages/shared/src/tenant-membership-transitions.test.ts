import { describe, expect, test } from "bun:test";

import {
  canTransitionTenantMembershipStatus,
  isTerminalTenantMembershipStatus,
} from "./tenant-membership-transitions";
import { TenantMembershipStatus } from "./tenant-portal-types";

describe("tenant membership transitions", () => {
  test("pending_invite can become active", () => {
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.PENDING_INVITE,
        TenantMembershipStatus.ACTIVE
      )
    ).toBe(true);
  });

  test("pending_acceptance can become active or declined", () => {
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.PENDING_ACCEPTANCE,
        TenantMembershipStatus.ACTIVE
      )
    ).toBe(true);
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.PENDING_ACCEPTANCE,
        TenantMembershipStatus.DECLINED
      )
    ).toBe(true);
  });

  test("active can become revoked or ended", () => {
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.ACTIVE,
        TenantMembershipStatus.REVOKED
      )
    ).toBe(true);
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.ACTIVE,
        TenantMembershipStatus.ENDED
      )
    ).toBe(true);
  });

  test("terminal statuses cannot transition", () => {
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.DECLINED,
        TenantMembershipStatus.ACTIVE
      )
    ).toBe(false);
    expect(isTerminalTenantMembershipStatus(TenantMembershipStatus.ENDED)).toBe(true);
    expect(isTerminalTenantMembershipStatus(TenantMembershipStatus.ACTIVE)).toBe(false);
  });

  test("same-status transition is rejected", () => {
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.ACTIVE,
        TenantMembershipStatus.ACTIVE
      )
    ).toBe(false);
  });

  test("listed can become pending_invite or ended", () => {
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.LISTED,
        TenantMembershipStatus.PENDING_INVITE
      )
    ).toBe(true);
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.LISTED,
        TenantMembershipStatus.PENDING_ACCEPTANCE
      )
    ).toBe(true);
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.LISTED,
        TenantMembershipStatus.ENDED
      )
    ).toBe(true);
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.LISTED,
        TenantMembershipStatus.ACTIVE
      )
    ).toBe(false);
  });

  test("expired and revoked secondaries can be re-invited to pending", () => {
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.EXPIRED,
        TenantMembershipStatus.PENDING_INVITE
      )
    ).toBe(true);
    expect(
      canTransitionTenantMembershipStatus(
        TenantMembershipStatus.REVOKED,
        TenantMembershipStatus.PENDING_ACCEPTANCE
      )
    ).toBe(true);
  });
});
