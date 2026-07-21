import { describe, expect, mock, test } from "bun:test";

import { PropertyRole } from "@/packages/shared";
import { buildTenantEmailCampaignRow } from "@/test-fixtures/db-rows/tenant-email-campaign-row";
import { testDateTime } from "@/test-fixtures/dates";
import { sequentialUuid } from "@/test-fixtures/ids";
import { mockAsyncFn } from "@/test-fixtures/mocks";

const OWNER_USER_ID = "22222222-2222-4222-8222-222222222222";
const MANAGER_USER_ID = "33333333-3333-4333-8333-333333333333";

function buildRecentCampaignRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...buildTenantEmailCampaignRow(overrides),
    property_name: "Alpha Property",
  };
}

const mockQuery = mockAsyncFn((_sql: string, _values?: unknown[]) => Promise.resolve({ rows: [] }));

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyTenantEmailCampaignsDb } = await import("./property-tenant-email-campaigns");

describe("propertyTenantEmailCampaignsDb.listRecentForAccessibleProperties", () => {
  test("returns campaigns ordered newest first with property names", async () => {
    mockQuery.mockClear();
    mockQuery.mockImplementationOnce((_sql, _values) =>
      Promise.resolve({
        rows: [
          buildRecentCampaignRow({
            created_at: testDateTime(-1),
            id: sequentialUuid(1),
            subject: "Newer notice",
          }),
          buildRecentCampaignRow({
            created_at: testDateTime(-2),
            id: sequentialUuid(2),
            subject: "Older notice",
          }),
        ],
      })
    );

    const campaigns = await propertyTenantEmailCampaignsDb.listRecentForAccessibleProperties(
      OWNER_USER_ID,
      false,
      6
    );

    expect(campaigns).toHaveLength(2);
    expect(campaigns[0]?.subject).toBe("Newer notice");
    expect(campaigns[1]?.subject).toBe("Older notice");
    expect(campaigns[0]?.propertyName).toBe("Alpha Property");
  });

  test("passes limit to query", async () => {
    mockQuery.mockClear();

    await propertyTenantEmailCampaignsDb.listRecentForAccessibleProperties(OWNER_USER_ID, false, 3);

    const [sql, values] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("LIMIT $");
    expect(values?.[values.length - 1]).toBe(3);
  });

  test("orders by created_at DESC in SQL", async () => {
    mockQuery.mockClear();

    await propertyTenantEmailCampaignsDb.listRecentForAccessibleProperties(OWNER_USER_ID, false, 6);

    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("ORDER BY c.created_at DESC, c.id DESC");
  });

  test("excludes email bodies from select", async () => {
    mockQuery.mockClear();

    await propertyTenantEmailCampaignsDb.listRecentForAccessibleProperties(OWNER_USER_ID, false, 6);

    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).not.toContain("html_body");
    expect(sql).not.toContain("text_body");
  });

  test("filters to owner or creator properties for non-admin users", async () => {
    mockQuery.mockClear();

    await propertyTenantEmailCampaignsDb.listRecentForAccessibleProperties(OWNER_USER_ID, false, 6);

    const [sql, values] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("p.created_by = $1");
    expect(sql).toContain("property_members pm");
    expect(sql).toContain("pm.role = $3::property_role");
    expect(values?.[0]).toBe(OWNER_USER_ID);
    expect(values?.[1]).toBe(OWNER_USER_ID);
    expect(values?.[2]).toBe(PropertyRole.OWNER);
    expect(values?.[3]).toBe(6);
  });

  test("does not apply owner filter for platform admin", async () => {
    mockQuery.mockClear();

    await propertyTenantEmailCampaignsDb.listRecentForAccessibleProperties(OWNER_USER_ID, true, 6);

    const [sql, values] = mockQuery.mock.calls[0]!;
    expect(sql).not.toContain("property_members");
    expect(sql).not.toContain("p.created_by");
    expect(values).toEqual([6]);
  });

  test("uses owner role gate so manager-only members are excluded at query time", async () => {
    mockQuery.mockClear();

    await propertyTenantEmailCampaignsDb.listRecentForAccessibleProperties(
      MANAGER_USER_ID,
      false,
      6
    );

    const [sql, values] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("pm.role = $3::property_role");
    expect(values?.[0]).toBe(MANAGER_USER_ID);
    expect(values?.[2]).toBe(PropertyRole.OWNER);
  });
});
