import { describe, expect, test } from "bun:test";

import { duplicateUnitNumberMessage } from "@/routes/admin/property-unit-errors";
import { UnitKind } from "@/packages/shared";

describe("duplicateUnitNumberMessage", () => {
  test("returns unit message for rentable kind", () => {
    expect(duplicateUnitNumberMessage(UnitKind.RENTABLE)).toBe(
      "A unit with this number already exists on this property"
    );
  });

  test("returns amenity message for amenity kind", () => {
    expect(duplicateUnitNumberMessage(UnitKind.AMENITY)).toBe(
      "An amenity with this name already exists on this property"
    );
  });
});
