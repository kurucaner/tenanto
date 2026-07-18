import { describe, expect, mock, test } from "bun:test";

import {
  buildDescendingTenantEmailCampaignRows,
  createPaginationMockQuery,
  findListQuerySql,
} from "@/test-fixtures/pagination";

const mockQuery = createPaginationMockQuery({
  rows: buildDescendingTenantEmailCampaignRows(),
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

    const sql = findListQuerySql(mockQuery);
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

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("subject ILIKE");
  });
});
