import { describe, expect, test } from "bun:test";

import {
  canTransitionPropertyMemberInviteStatus,
  isPendingPropertyMemberInviteStatus,
  isTerminalPropertyMemberInviteStatus,
} from "./property-member-invite-transitions";
import { PropertyInviteStatus } from "./property-types";

describe("property member invite transitions", () => {
  test("pending_invite can become accepted or declined", () => {
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_INVITE,
        PropertyInviteStatus.ACCEPTED
      )
    ).toBe(true);
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_INVITE,
        PropertyInviteStatus.DECLINED
      )
    ).toBe(true);
  });

  test("pending_acceptance can become accepted or declined", () => {
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_ACCEPTANCE,
        PropertyInviteStatus.ACCEPTED
      )
    ).toBe(true);
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_ACCEPTANCE,
        PropertyInviteStatus.DECLINED
      )
    ).toBe(true);
  });

  test("legacy pending is treated as pending", () => {
    expect(isPendingPropertyMemberInviteStatus(PropertyInviteStatus.PENDING)).toBe(true);
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING,
        PropertyInviteStatus.EXPIRED
      )
    ).toBe(true);
  });

  test("terminal statuses cannot transition", () => {
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.DECLINED,
        PropertyInviteStatus.ACCEPTED
      )
    ).toBe(false);
    expect(isTerminalPropertyMemberInviteStatus(PropertyInviteStatus.EXPIRED)).toBe(true);
    expect(isTerminalPropertyMemberInviteStatus(PropertyInviteStatus.PENDING_INVITE)).toBe(false);
  });

  test("same-status transition is rejected", () => {
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_INVITE,
        PropertyInviteStatus.PENDING_INVITE
      )
    ).toBe(false);
  });
});
