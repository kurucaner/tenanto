import { describe, expect, mock, test } from "bun:test";

const mockQuery = mock((sql: string) => {
  if (sql.includes("COUNT(*)")) {
    return Promise.resolve({
      rows: [{ total_count: 3 }],
    });
  }

  return Promise.resolve({
    rows: [
      {
        completed_at: null,
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        created_by: "user-1",
        failed_count: 0,
        id: "11111111-1111-4111-8111-111111111111",
        idempotency_key: "key-1",
        property_id: "prop-1",
        recipient_count: 10,
        sent_count: 10,
        skipped_count: 0,
        status: "completed",
        subject: "Rent reminder July",
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
      {
        completed_at: null,
        created_at: new Date("2026-07-08T10:00:00.000Z"),
        created_by: "user-1",
        failed_count: 0,
        id: "22222222-2222-4222-8222-222222222222",
        idempotency_key: "key-2",
        property_id: "prop-1",
        recipient_count: 5,
        sent_count: 5,
        skipped_count: 0,
        status: "completed",
        subject: "Welcome notice",
        updated_at: new Date("2026-07-08T10:00:00.000Z"),
      },
      {
        completed_at: null,
        created_at: new Date("2026-07-07T10:00:00.000Z"),
        created_by: "user-1",
        failed_count: 1,
        id: "33333333-3333-4333-8333-333333333333",
        idempotency_key: "key-3",
        property_id: "prop-1",
        recipient_count: 8,
        sent_count: 7,
        skipped_count: 0,
        status: "completed_with_errors",
        subject: "Maintenance update",
        updated_at: new Date("2026-07-07T10:00:00.000Z"),
      },
    ],
  });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyTenantEmailCampaignsDb } = await import("./property-tenant-email-campaigns");

describe("propertyTenantEmailCampaignsDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyTenantEmailCampaignsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );

    expect(firstPage.campaigns).toHaveLength(2);
    expect(firstPage.campaigns[0]?.subject).toBe("Rent reminder July");
    expect(firstPage.campaigns[1]?.subject).toBe("Welcome notice");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("ORDER BY created_at DESC, id DESC");
    expect(sql).not.toContain("html_body");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyTenantEmailCampaignsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyTenantEmailCampaignsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("(created_at, id) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyTenantEmailCampaignsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyTenantEmailCampaignsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("applies search filter on subject", async () => {
    mockQuery.mockClear();

    await propertyTenantEmailCampaignsDb.listPaginatedByProperty(
      "prop-1",
      { q: "rent" },
      { limit: 2 }
    );

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("subject ILIKE");
  });
});
