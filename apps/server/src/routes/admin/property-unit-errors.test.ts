import { describe, expect, test } from "bun:test";

import { duplicateUnitNumberMessage, formatUnitDeleteBlockedMessage } from "./property-unit-errors";

describe("duplicateUnitNumberMessage", () => {
  test("returns unit duplicate message", () => {
    expect(duplicateUnitNumberMessage()).toBe(
      "A unit with this number already exists on this property"
    );
  });
});

describe("formatUnitDeleteBlockedMessage", () => {
  test("describes reservation count", () => {
    expect(
      formatUnitDeleteBlockedMessage({ incomeLineCount: 0, longStayCount: 0, reservationCount: 2 })
    ).toBe("This unit cannot be deleted because it has 2 reservation records");
  });

  test("describes single income record", () => {
    expect(
      formatUnitDeleteBlockedMessage({ incomeLineCount: 1, longStayCount: 0, reservationCount: 0 })
    ).toBe("This unit cannot be deleted because it has 1 income record");
  });

  test("describes single long stay record", () => {
    expect(
      formatUnitDeleteBlockedMessage({ incomeLineCount: 0, longStayCount: 1, reservationCount: 0 })
    ).toBe("This unit cannot be deleted because it has 1 long stay record");
  });

  test("describes both blockers", () => {
    expect(
      formatUnitDeleteBlockedMessage({ incomeLineCount: 3, longStayCount: 0, reservationCount: 1 })
    ).toBe("This unit cannot be deleted because it has reservation and income records");
  });

  test("describes all three blockers", () => {
    expect(
      formatUnitDeleteBlockedMessage({ incomeLineCount: 3, longStayCount: 2, reservationCount: 1 })
    ).toBe(
      "This unit cannot be deleted because it has reservation and income and long stay records"
    );
  });
});
