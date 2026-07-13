import { describe, expect, test } from "bun:test";

import {
  buildIncomeImportDuplicateWarningsByIndex,
  buildIncomeImportStayDuplicateKey,
  INCOME_IMPORT_BATCH_DUPLICATE_WARNING,
  INCOME_IMPORT_DUPLICATE_WARNING,
} from "./income-import-duplicate-utils";

describe("income import duplicate detection", () => {
  test("matches stays by guest, unit, and stay dates", () => {
    const key = buildIncomeImportStayDuplicateKey({
      checkIn: "2026-02-07",
      checkOut: "2026-02-08",
      guestName: "Alexandar Kopilovic",
      unitId: "unit-210",
    });

    expect(key).toBe(
      buildIncomeImportStayDuplicateKey({
        checkIn: "2026-02-07",
        checkOut: "2026-02-08",
        guestName: "  alexandar kopilovic ",
        unitId: "unit-210",
      })
    );
  });

  test("warns when a row matches an existing stay", () => {
    const warnings = buildIncomeImportDuplicateWarningsByIndex(
      [
        {
          checkIn: "2026-02-07",
          checkOut: "2026-02-08",
          guestName: "Alexandar Kopilovic",
          unitId: "unit-210",
        },
      ],
      [
        {
          checkIn: "2026-02-07",
          checkOut: "2026-02-08",
          guestName: "Alexandar Kopilovic",
          unitId: "unit-210",
        },
      ]
    );

    expect(warnings.get(0)).toBe(INCOME_IMPORT_DUPLICATE_WARNING);
  });

  test("warns on later duplicate rows within the same import batch", () => {
    const warnings = buildIncomeImportDuplicateWarningsByIndex(
      [
        {
          checkIn: "2026-02-07",
          checkOut: "2026-02-08",
          guestName: "Guest A",
          unitId: "unit-210",
        },
        {
          checkIn: "2026-02-07",
          checkOut: "2026-02-08",
          guestName: "Guest A",
          unitId: "unit-210",
        },
      ],
      []
    );

    expect(warnings.has(0)).toBe(false);
    expect(warnings.get(1)).toBe(INCOME_IMPORT_BATCH_DUPLICATE_WARNING);
  });
});
