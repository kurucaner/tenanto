import { describe, expect, mock, test } from "bun:test";

import { PropertyRole, type TPropertyRole } from "@/packages/shared";
import { mockPoolQuery } from "@/test-fixtures/mocks";

const PROPERTY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

type TPropertyListQueryRow = {
  address: string;
  caller_role: TPropertyRole | null;
  created_at: Date;
  created_by: string;
  favorited_at: Date | null;
  id: string;
  legal_name: null;
  member_count: number;
  name: string;
  phone_number: null;
  unit_count: number;
  updated_at: Date;
};

const mockQuery = mockPoolQuery<TPropertyListQueryRow>((_sql: string, _values?: unknown[]) =>
  Promise.resolve({
    rows: [
      {
        address: "123 Main St",
        caller_role: PropertyRole.MANAGER,
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        created_by: USER_ID,
        favorited_at: null,
        id: PROPERTY_ID,
        legal_name: null,
        member_count: 2,
        name: "Alpha",
        phone_number: null,
        unit_count: 1,
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
    ],
  })
);

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { mapPropertyRow } = await import("./mappers");
const { propertiesDb } = await import("./properties");

describe("mapPropertyRow callerRole", () => {
  test("maps owner caller_role", () => {
    const property = mapPropertyRow({
      address: "123 Main St",
      caller_role: PropertyRole.OWNER,
      created_at: new Date("2026-07-09T10:00:00.000Z"),
      created_by: USER_ID,
      id: PROPERTY_ID,
      legal_name: null,
      member_count: 1,
      name: "Alpha",
      phone_number: null,
      unit_count: 0,
      updated_at: new Date("2026-07-09T10:00:00.000Z"),
    });

    expect(property.callerRole).toBe(PropertyRole.OWNER);
  });

  test("maps caller_role to callerRole", () => {
    const property = mapPropertyRow({
      address: "123 Main St",
      caller_role: PropertyRole.ACCOUNTANT,
      created_at: new Date("2026-07-09T10:00:00.000Z"),
      created_by: USER_ID,
      id: PROPERTY_ID,
      legal_name: null,
      member_count: 1,
      name: "Alpha",
      phone_number: null,
      unit_count: 0,
      updated_at: new Date("2026-07-09T10:00:00.000Z"),
    });

    expect(property.callerRole).toBe(PropertyRole.ACCOUNTANT);
  });

  test("defaults callerRole to null when caller_role is absent", () => {
    const property = mapPropertyRow({
      address: "123 Main St",
      created_at: new Date("2026-07-09T10:00:00.000Z"),
      created_by: USER_ID,
      id: PROPERTY_ID,
      legal_name: null,
      member_count: 1,
      name: "Alpha",
      phone_number: null,
      unit_count: 0,
      updated_at: new Date("2026-07-09T10:00:00.000Z"),
    });

    expect(property.callerRole).toBeNull();
  });
});

describe("propertiesDb listPaginated callerRole", () => {
  test("user list selects viewer membership role and maps callerRole", async () => {
    mockQuery.mockClear();

    const page = await propertiesDb.listPaginatedForUser({
      limit: 10,
      userId: USER_ID,
    });

    expect(page.items[0]?.callerRole).toBe(PropertyRole.MANAGER);

    const [sql, values] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("property_members pm_viewer");
    expect(sql).toContain("pm_viewer.user_id = $1");
    expect(sql).toContain("AS caller_role");
    expect(values?.[0]).toBe(USER_ID);
  });

  test("admin list omits membership subquery and returns null callerRole", async () => {
    mockQuery.mockClear();
    mockQuery.mockImplementationOnce((_sql: string, _values?: unknown[]) =>
      Promise.resolve({
        rows: [
          {
            address: "123 Main St",
            caller_role: null,
            created_at: new Date("2026-07-09T10:00:00.000Z"),
            created_by: USER_ID,
            favorited_at: null,
            id: PROPERTY_ID,
            legal_name: null,
            member_count: 2,
            name: "Alpha",
            phone_number: null,
            unit_count: 1,
            updated_at: new Date("2026-07-09T10:00:00.000Z"),
          },
        ],
      })
    );

    const page = await propertiesDb.listPaginatedForAdmin({
      limit: 10,
      userId: USER_ID,
    });

    expect(page.items[0]?.callerRole).toBeNull();

    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).not.toContain("property_members pm_viewer");
    expect(sql).toContain("NULL::text AS caller_role");
  });
});
