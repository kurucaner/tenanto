import { beforeEach, describe, expect, test } from "bun:test";

import { PropertyInviteStatus } from "@/packages/shared";
import { makeInvite, makeMember, makeProperty, makeUser } from "@/test-fixtures/domain";
import {
  createPropertyMemberInviteActionMocks,
  registerPropertyMemberInviteActionModules,
  resetMocks,
} from "@/test-fixtures/mocks";

const actionMocks = createPropertyMemberInviteActionMocks();
registerPropertyMemberInviteActionModules(actionMocks);

const { propertyMemberInviteActionService } =
  await import("./property-member-invite-action-service");

describe("propertyMemberInviteActionService.redeemInvite", () => {
  beforeEach(() => {
    resetMocks(
      actionMocks.findByInviteToken,
      actionMocks.findOneMember,
      actionMocks.addMember,
      actionMocks.transitionStatus,
      actionMocks.expireInviteIfPastTtl,
      actionMocks.findByIdProperty
    );
    actionMocks.findOneMember.mockResolvedValue(null);
    actionMocks.expireInviteIfPastTtl.mockResolvedValue(null);
    actionMocks.findByIdProperty.mockResolvedValue(
      makeProperty({
        address: "123 Main St",
        createdBy: "owner-1",
        name: "Sunset Apartments",
        unitCount: 1,
      })
    );
  });

  test("adds member and marks invite accepted", async () => {
    const invite = makeInvite();
    const member = makeMember();
    actionMocks.findByInviteToken.mockResolvedValueOnce(invite);
    actionMocks.addMember.mockResolvedValueOnce(member);
    actionMocks.transitionStatus.mockResolvedValueOnce({
      ...invite,
      status: PropertyInviteStatus.ACCEPTED,
    });

    const result = await propertyMemberInviteActionService.redeemInvite("token-abc", makeUser());

    expect(result.member.id).toBe("member-1");
    expect(actionMocks.transitionStatus).toHaveBeenCalledWith("invite-1", PropertyInviteStatus.ACCEPTED);
  });

  test("rejects invite sent to a different email", async () => {
    actionMocks.findByInviteToken.mockResolvedValueOnce(makeInvite({ email: "other@example.com" }));

    await expect(
      propertyMemberInviteActionService.redeemInvite("token-abc", makeUser())
    ).rejects.toThrow("This invite was sent to a different email address");
  });
});

describe("propertyMemberInviteActionService.declineInvite", () => {
  beforeEach(() => {
    resetMocks(actionMocks.findByIdInvite, actionMocks.transitionStatus, actionMocks.expireInviteIfPastTtl);
    actionMocks.expireInviteIfPastTtl.mockResolvedValue(null);
  });

  test("declines pending invite for matching user", async () => {
    const invite = makeInvite();
    actionMocks.findByIdInvite.mockResolvedValueOnce(invite);
    actionMocks.transitionStatus.mockResolvedValueOnce({
      ...invite,
      status: PropertyInviteStatus.DECLINED,
    });

    const result = await propertyMemberInviteActionService.declineInvite("invite-1", makeUser());

    expect(result.status).toBe(PropertyInviteStatus.DECLINED);
  });
});
