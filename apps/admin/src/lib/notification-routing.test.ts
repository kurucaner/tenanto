import { describe, expect, test } from "bun:test";

import { getNotificationHref } from "@/lib/notification-routing";
import { type IUserNotification } from "@/packages/shared";

describe("getNotificationHref", () => {
  test("deep links property member invite notifications to accept-invite by inviteId", () => {
    const notification: IUserNotification = {
      body: "You've been invited as Manager.",
      contextResourceId: "invite-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "notification-1",
      readAt: null,
      resourceId: "property-1",
      resourceType: "property",
      title: "Invitation to Sunset Apartments",
      type: "property_member_invite_received",
    };

    expect(getNotificationHref(notification)).toBe("/accept-invite?inviteId=invite-1");
  });

  test("deep links campaign completion notifications to the detail sheet", () => {
    const notification: IUserNotification = {
      body: "3 sent",
      contextResourceId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "notification-1",
      readAt: null,
      resourceId: "property-1",
      resourceType: "property",
      title: "Notification delivered",
      type: "tenant_email_campaign_completed",
    };

    expect(getNotificationHref(notification)).toBe(
      "/properties/property-1/communications?campaignId=campaign-1"
    );
  });
});
