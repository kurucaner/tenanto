import { describe, expect, test } from "bun:test";

const { mapPropertyExpenseCategoryTypeRow, mapPropertyIncomeLineTypeRow } =
  await import("./mappers");

describe("property catalog type mappers", () => {
  test("mapPropertyIncomeLineTypeRow omits archive fields from settings API shape", () => {
    const mapped = mapPropertyIncomeLineTypeRow({
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      deleted_at: new Date("2026-06-01T00:00:00.000Z"),
      id: "type-1",
      is_deleted: true,
      name: "Pool",
      property_id: "property-1",
      sort_order: 2,
      updated_at: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(mapped).toEqual({
      id: "type-1",
      name: "Pool",
      propertyId: "property-1",
      sortOrder: 2,
    });
    expect(mapped).not.toHaveProperty("isDeleted");
    expect(mapped).not.toHaveProperty("deletedAt");
  });

  test("mapPropertyExpenseCategoryTypeRow omits archive fields from settings API shape", () => {
    const mapped = mapPropertyExpenseCategoryTypeRow({
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      deleted_at: new Date("2026-06-01T00:00:00.000Z"),
      id: "category-1",
      is_annual_amount: true,
      is_deleted: true,
      is_system: false,
      name: "Insurance",
      property_id: "property-1",
      sort_order: 5,
      updated_at: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(mapped).toEqual({
      id: "category-1",
      isAnnualAmount: true,
      isSystem: false,
      name: "Insurance",
      propertyId: "property-1",
      sortOrder: 5,
    });
    expect(mapped).not.toHaveProperty("isDeleted");
    expect(mapped).not.toHaveProperty("deletedAt");
  });
});
