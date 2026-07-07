import { describe, expect, test } from "bun:test";

import {
  getPostgresErrorMeta,
  isPostgresForeignKeyViolation,
  isPostgresUniqueViolation,
} from "@/db/pg-errors";

describe("pg-errors", () => {
  test("detects unique and foreign key violations", () => {
    const unique = { code: "23505", constraint: "property_units_property_id_unit_number_key" };
    const foreignKey = { code: "23503", constraint: "property_reservations_unit_id_fkey" };

    expect(isPostgresUniqueViolation(unique)).toBe(true);
    expect(isPostgresForeignKeyViolation(unique)).toBe(false);
    expect(isPostgresForeignKeyViolation(foreignKey)).toBe(true);
    expect(getPostgresErrorMeta(foreignKey)).toEqual({
      code: "23503",
      constraint: "property_reservations_unit_id_fkey",
      table: null,
    });
  });
});
