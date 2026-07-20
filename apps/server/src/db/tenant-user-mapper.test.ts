import { describe, expect, test } from "bun:test";

import { mapTenantUserRow } from "./mappers";

describe("mapTenantUserRow", () => {
  test("maps SMS consent timestamps", () => {
    const consentedAt = new Date("2026-02-01T12:00:00.000Z");
    const optedOutAt = new Date("2026-02-02T12:00:00.000Z");

    const user = mapTenantUserRow({
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      email: "tenant@example.com",
      email_verified_at: new Date("2026-01-01T00:00:00.000Z"),
      id: "tenant-1",
      name: "Jane Tenant",
      phone: "+13055550100",
      phone_verified_at: new Date("2026-01-15T00:00:00.000Z"),
      sms_consented_at: consentedAt,
      sms_opted_out_at: optedOutAt,
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(user.smsConsentedAt).toBe(consentedAt.toISOString());
    expect(user.smsOptedOutAt).toBe(optedOutAt.toISOString());
  });

  test("maps null SMS consent timestamps", () => {
    const user = mapTenantUserRow({
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      email: "tenant@example.com",
      email_verified_at: null,
      id: "tenant-1",
      name: "Jane Tenant",
      phone: null,
      phone_verified_at: null,
      sms_consented_at: null,
      sms_opted_out_at: null,
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(user.smsConsentedAt).toBeNull();
    expect(user.smsOptedOutAt).toBeNull();
  });
});
