import { describe, expect, test } from "bun:test";

import { getNotificationHref } from "@/lib/notification-routing";
import { type IUserNotification } from "@/packages/shared";

describe("getNotificationHref", () => {
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
