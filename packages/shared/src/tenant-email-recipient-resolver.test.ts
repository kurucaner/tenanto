import { describe, expect, test } from "bun:test";

import type { IPropertyLongStay } from "./property-long-stay-types";
import {
  isValidTenantEmail,
  normalizeOptionalInviteEmail,
  normalizeTenantEmail,
  requireMembershipInviteEmail,
  resolveTenantEmailRecipients,
} from "./tenant-email-recipient-resolver";

function makeLease(
  overrides: Partial<IPropertyLongStay> & Pick<IPropertyLongStay, "id">
): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Primary Tenant",
    leaseEndDate: "2027-01-01",
    leaseStartDate: "2026-01-01",
    rentAmount: 1000,
    propertyId: "property-1",
    rentBillingCadence: "monthly",
    secondaryTenants: [],
    securityDepositAmount: null,
    status: "active",
    tenantEmail: "primary@example.com",
    tenantPhone: null,
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeTenantEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeTenantEmail("  Tenant@Example.COM ")).toBe("tenant@example.com");
  });
});

describe("isValidTenantEmail", () => {
  test("accepts common addresses", () => {
    expect(isValidTenantEmail("tenant@example.com")).toBe(true);
  });

  test("rejects malformed addresses", () => {
    expect(isValidTenantEmail("not-an-email")).toBe(false);
    expect(isValidTenantEmail("")).toBe(false);
    expect(isValidTenantEmail("user@domain")).toBe(false);
    expect(isValidTenantEmail("@example.com")).toBe(false);
    expect(isValidTenantEmail("user@.com")).toBe(false);
  });
});

describe("normalizeOptionalInviteEmail", () => {
  test("returns null for empty values", () => {
    expect(normalizeOptionalInviteEmail(null)).toBeNull();
    expect(normalizeOptionalInviteEmail(undefined)).toBeNull();
    expect(normalizeOptionalInviteEmail("")).toBeNull();
    expect(normalizeOptionalInviteEmail("   ")).toBeNull();
  });

  test("normalizes valid email", () => {
    expect(normalizeOptionalInviteEmail(" Tenant@Example.com ")).toBe("tenant@example.com");
  });

  test("throws for invalid email", () => {
    expect(() => normalizeOptionalInviteEmail("not-an-email")).toThrow(
      "email must be a valid email address"
    );
  });
});

describe("requireMembershipInviteEmail", () => {
  test("returns normalized email when present", () => {
    expect(requireMembershipInviteEmail(" Tenant@Example.com ")).toBe("tenant@example.com");
  });

  test("throws when email is missing", () => {
    expect(() => requireMembershipInviteEmail(null)).toThrow(
      "Membership has no valid invite email"
    );
  });
});

describe("resolveTenantEmailRecipients", () => {
  test("includes primary and secondary contacts from active leases", () => {
    const result = resolveTenantEmailRecipients(
      [
        makeLease({
          id: "lease-1",
          tenantEmail: "primary@example.com",
        }),
      ],
      new Map([
        [
          "lease-1",
          [{ effectiveEmail: "secondary@example.com", effectiveName: "Secondary Tenant" }],
        ],
      ])
    );

    expect(result.recipients).toEqual([
      {
        email: "primary@example.com",
        leaseId: "lease-1",
        tenantName: "Primary Tenant",
        tenantRole: "primary",
      },
      {
        email: "secondary@example.com",
        leaseId: "lease-1",
        tenantName: "Secondary Tenant",
        tenantRole: "secondary",
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  test("includes secondary from listed membership invite email", () => {
    const result = resolveTenantEmailRecipients(
      [makeLease({ id: "lease-1" })],
      new Map([
        ["lease-1", [{ effectiveEmail: "listed@example.com", effectiveName: "Listed Secondary" }]],
      ])
    );

    expect(result.recipients).toEqual([
      {
        email: "primary@example.com",
        leaseId: "lease-1",
        tenantName: "Primary Tenant",
        tenantRole: "primary",
      },
      {
        email: "listed@example.com",
        leaseId: "lease-1",
        tenantName: "Listed Secondary",
        tenantRole: "secondary",
      },
    ]);
  });

  test("includes secondary from linked active user email", () => {
    const result = resolveTenantEmailRecipients(
      [makeLease({ id: "lease-1" })],
      new Map([
        ["lease-1", [{ effectiveEmail: "portal@example.com", effectiveName: "Portal Secondary" }]],
      ])
    );

    expect(result.recipients).toContainEqual({
      email: "portal@example.com",
      leaseId: "lease-1",
      tenantName: "Portal Secondary",
      tenantRole: "secondary",
    });
  });

  test("returns primary-only audience when secondary contact map is empty", () => {
    const result = resolveTenantEmailRecipients([makeLease({ id: "lease-1" })], new Map());

    expect(result.recipients).toEqual([
      {
        email: "primary@example.com",
        leaseId: "lease-1",
        tenantName: "Primary Tenant",
        tenantRole: "primary",
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  test("returns primary-only audience when secondary contact map is omitted", () => {
    const result = resolveTenantEmailRecipients([makeLease({ id: "lease-1" })]);

    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]?.tenantRole).toBe("primary");
  });

  test("skips ended leases", () => {
    const result = resolveTenantEmailRecipients([
      makeLease({ id: "lease-1", status: "ended", tenantEmail: "primary@example.com" }),
    ]);

    expect(result.recipients).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  test("dedupes normalized email addresses across leases", () => {
    const result = resolveTenantEmailRecipients([
      makeLease({ id: "lease-1", tenantEmail: "Shared@Example.com" }),
      makeLease({
        guestName: "Other Tenant",
        id: "lease-2",
        tenantEmail: "shared@example.com",
        unitId: "unit-2",
      }),
    ]);

    expect(result.recipients).toHaveLength(1);
    expect(result.skipped).toEqual([
      {
        leaseId: "lease-2",
        reason: "Duplicate email address in campaign audience",
        tenantName: "Other Tenant",
        tenantRole: "primary",
      },
    ]);
  });

  test("dedupes duplicate secondary email across leases", () => {
    const result = resolveTenantEmailRecipients(
      [makeLease({ id: "lease-1" }), makeLease({ guestName: "Other Primary", id: "lease-2" })],
      new Map([
        ["lease-1", [{ effectiveEmail: "shared@example.com", effectiveName: "Secondary One" }]],
        ["lease-2", [{ effectiveEmail: "Shared@Example.com", effectiveName: "Secondary Two" }]],
      ])
    );

    expect(
      result.recipients.filter((recipient) => recipient.tenantRole === "secondary")
    ).toHaveLength(1);
    expect(result.skipped).toContainEqual({
      leaseId: "lease-2",
      reason: "Duplicate email address in campaign audience",
      tenantName: "Secondary Two",
      tenantRole: "secondary",
    });
  });

  test("resolves 500 unique recipients for load-test sizing", () => {
    const leases = Array.from({ length: 500 }, (_, index) =>
      makeLease({
        guestName: `Tenant ${index}`,
        id: `lease-${index}`,
        tenantEmail: `tenant-${index}@example.com`,
        unitId: `unit-${index}`,
      })
    );

    const result = resolveTenantEmailRecipients(leases);

    expect(result.recipients).toHaveLength(500);
    expect(result.skipped).toHaveLength(0);
  });

  test("records skipped tenants with missing or invalid emails", () => {
    const result = resolveTenantEmailRecipients(
      [
        makeLease({
          id: "lease-1",
          tenantEmail: null,
        }),
      ],
      new Map([
        [
          "lease-1",
          [
            { effectiveEmail: null, effectiveName: "Name Only Secondary" },
            { effectiveEmail: "bad-email", effectiveName: "Bad Secondary" },
          ],
        ],
      ])
    );

    expect(result.recipients).toEqual([]);
    expect(result.skipped).toEqual([
      {
        leaseId: "lease-1",
        reason: "Missing email address",
        tenantName: "Primary Tenant",
        tenantRole: "primary",
      },
      {
        leaseId: "lease-1",
        reason: "Missing email address",
        tenantName: "Name Only Secondary",
        tenantRole: "secondary",
      },
      {
        leaseId: "lease-1",
        reason: "Invalid email address",
        tenantName: "Bad Secondary",
        tenantRole: "secondary",
      },
    ]);
  });
});
