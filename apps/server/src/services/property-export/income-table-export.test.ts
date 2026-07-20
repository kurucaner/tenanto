import { describe, expect, test } from "bun:test";

import { IncomeEntryKind } from "@/packages/shared";
import { makeIncomeLine, makeReservation } from "@/test-fixtures/domain";

import { mapIncomeEntryToExportRow } from "./income-table-export";

const UNIT_LABEL_BY_ID = new Map([["unit-1", "101"]]);

describe("mapIncomeEntryToExportRow", () => {
  test("maps stay type label", () => {
    const row = mapIncomeEntryToExportRow(
      { entryKind: IncomeEntryKind.STAY, stay: makeReservation() },
      UNIT_LABEL_BY_ID
    );

    expect(row[0]).toBe("Stay");
  });

  test("maps line type label from income line type name", () => {
    const row = mapIncomeEntryToExportRow(
      { entryKind: IncomeEntryKind.LINE, line: makeIncomeLine() },
      UNIT_LABEL_BY_ID
    );

    expect(row[0]).toBe("Late fee");
  });

  test("falls back to income line type id when name is missing", () => {
    const row = mapIncomeEntryToExportRow(
      {
        entryKind: IncomeEntryKind.LINE,
        line: makeIncomeLine({ incomeLineTypeId: "type-parking", incomeLineTypeName: undefined }),
      },
      UNIT_LABEL_BY_ID
    );

    expect(row[0]).toBe("type-parking");
  });

  test("maps longTerm type label regardless of income line type name", () => {
    const row = mapIncomeEntryToExportRow(
      {
        entryKind: IncomeEntryKind.LONG_TERM,
        line: makeIncomeLine({
          incomeLineTypeId: "type-rent",
          incomeLineTypeName: "Rent",
          longStayId: "lease-1",
        }),
      },
      UNIT_LABEL_BY_ID
    );

    expect(row[0]).toBe("Long term");
  });
});
