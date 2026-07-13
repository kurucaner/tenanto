import { describe, expect, test } from "bun:test";

import { type IIncomeImportParsedRow, ReservationStatus } from "@/packages/shared";

import { sortIncomeImportPreviewRowsByAttention } from "./import-income-csv-preview-utils";

function buildPreviewRow(
  overrides: Partial<IIncomeImportParsedRow> &
    Pick<IIncomeImportParsedRow, "guestName" | "rowIndex">
): IIncomeImportParsedRow {
  return {
    channelCommissionId: "channel-1",
    checkIn: "2026-02-07",
    checkOut: "2026-02-08",
    cleaningFee: 0,
    nights: 1,
    refunded: false,
    roomTotal: 100,
    sourceFileName: "import.csv",
    status: ReservationStatus.STAYED,
    unitId: "unit-1",
    ...overrides,
  };
}

describe("sortIncomeImportPreviewRowsByAttention", () => {
  test("preserves order when all rows are valid", () => {
    const rows = [
      buildPreviewRow({ guestName: "Alice", rowIndex: 1 }),
      buildPreviewRow({ guestName: "Bob", rowIndex: 2 }),
      buildPreviewRow({ guestName: "Carol", rowIndex: 3 }),
    ];

    expect(sortIncomeImportPreviewRowsByAttention(rows).map((item) => item.sourceIndex)).toEqual([
      0, 1, 2,
    ]);
  });

  test("moves validation-error rows to the top", () => {
    const rows = [
      buildPreviewRow({ guestName: "Valid A", rowIndex: 1 }),
      buildPreviewRow({ guestName: "Invalid B", rowIndex: 2, validationError: "Missing unit" }),
      buildPreviewRow({ guestName: "Valid C", rowIndex: 3 }),
      buildPreviewRow({ guestName: "Invalid D", rowIndex: 4, validationError: "Missing channel" }),
    ];

    expect(sortIncomeImportPreviewRowsByAttention(rows).map((item) => item.sourceIndex)).toEqual([
      1, 3, 0, 2,
    ]);
  });

  test("keeps stable order among multiple invalid rows", () => {
    const rows = [
      buildPreviewRow({ guestName: "Valid", rowIndex: 1 }),
      buildPreviewRow({ guestName: "Invalid first", rowIndex: 2, validationError: "Error 1" }),
      buildPreviewRow({ guestName: "Invalid second", rowIndex: 3, validationError: "Error 2" }),
    ];

    expect(sortIncomeImportPreviewRowsByAttention(rows).map((item) => item.sourceIndex)).toEqual([
      1, 2, 0,
    ]);
  });
});
