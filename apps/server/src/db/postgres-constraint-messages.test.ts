import { describe, expect, test } from "bun:test";

import {
  getConstraintErrorCode,
  getConstraintMessage,
} from "@/db/postgres-constraint-messages";

describe("postgres constraint messages", () => {
  test("maps reservation FK to friendly delete message", () => {
    expect(getConstraintMessage("property_reservations_unit_id_fkey", "fallback")).toBe(
      "This unit cannot be deleted because it has reservation records"
    );
    expect(getConstraintErrorCode("property_reservations_unit_id_fkey")).toBe(
      "UNIT_HAS_RESERVATIONS"
    );
  });

  test("maps income FK to friendly delete message", () => {
    expect(getConstraintMessage("property_income_lines_unit_id_fkey", "fallback")).toBe(
      "This unit cannot be deleted because it has income records"
    );
    expect(getConstraintErrorCode("property_income_lines_unit_id_fkey")).toBe("UNIT_HAS_INCOME");
  });

  test("maps unique unit number constraint", () => {
    expect(getConstraintMessage("property_units_property_id_unit_number_key", "fallback")).toBe(
      "A unit or amenity with this name already exists on this property"
    );
    expect(getConstraintErrorCode("property_units_property_id_unit_number_key")).toBe(
      "DUPLICATE_UNIT_NUMBER"
    );
  });

  test("returns fallback for unknown constraints", () => {
    expect(getConstraintMessage("unknown_constraint", "custom fallback")).toBe("custom fallback");
    expect(getConstraintErrorCode("unknown_constraint")).toBeUndefined();
  });
});
