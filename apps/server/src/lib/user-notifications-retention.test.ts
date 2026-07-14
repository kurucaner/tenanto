import { describe, expect, test } from "bun:test";

import {
  getUserNotificationsRetentionCutoff,
  USER_NOTIFICATIONS_RETENTION_DAYS,
} from "./user-notifications-retention";

describe("getUserNotificationsRetentionCutoff", () => {
  test("returns a cutoff 30 days before the reference time", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const cutoff = getUserNotificationsRetentionCutoff(now);

    expect(USER_NOTIFICATIONS_RETENTION_DAYS).toBe(30);
    expect(cutoff.toISOString()).toBe("2026-06-14T12:00:00.000Z");
  });
});
