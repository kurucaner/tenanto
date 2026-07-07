import { describe, expect, test } from "bun:test";

import { duplicateUnitNumberMessage, formatUnitDeleteBlockedMessage } from "@/routes/admin/property-unit-errors";
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

describe("formatUnitDeleteBlockedMessage", () => {
  test("describes reservation count", () => {
    expect(
      formatUnitDeleteBlockedMessage({ incomeLineCount: 0, reservationCount: 2 })
    ).toBe("This unit cannot be deleted because it has 2 reservation records");
  });

  test("describes single income record", () => {
    expect(
      formatUnitDeleteBlockedMessage({ incomeLineCount: 1, reservationCount: 0 })
    ).toBe("This unit cannot be deleted because it has 1 income record");
  });

  test("describes both blockers", () => {
    expect(
      formatUnitDeleteBlockedMessage({ incomeLineCount: 3, reservationCount: 1 })
    ).toBe("This unit cannot be deleted because it has reservation and income records");
  });
});
