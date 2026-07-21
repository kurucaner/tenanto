import { describe, expect, test } from "bun:test";

import { parseCreateIncomeLineBody } from "./parse-create-income-line-body";

const miscTypeId = "00000000-0000-4000-8000-000000000001";
const leaseId = "00000000-0000-4000-8000-000000000002";

describe("parseCreateIncomeLineBody", () => {
  test("requires incomeLineTypeId for misc income lines", () => {
    const parsed = parseCreateIncomeLineBody({
      amount: 100,
      transactionDate: "2026-02-10",
    });

    expect(parsed).toEqual({
      error: "incomeLineTypeId must be a valid UUID",
      ok: false,
    });
  });

  test("accepts misc create when incomeLineTypeId is a valid UUID", () => {
    const parsed = parseCreateIncomeLineBody({
      amount: 100,
      incomeLineTypeId: miscTypeId,
      transactionDate: "2026-02-10",
    });

    expect(parsed).toEqual({
      body: {
        amount: 100,
        description: undefined,
        guestName: undefined,
        incomeLineTypeId: miscTypeId,
        longStayId: undefined,
        rentPeriodKey: undefined,
        reservationId: undefined,
        transactionDate: "2026-02-10",
        unitId: null,
      },
      ok: true,
    });
  });

  test("accepts lease rent create without incomeLineTypeId when longStayId is set", () => {
    const parsed = parseCreateIncomeLineBody({
      amount: 1500,
      longStayId: leaseId,
      transactionDate: "2026-02-10",
    });

    expect(parsed).toEqual({
      body: {
        amount: 1500,
        description: undefined,
        guestName: undefined,
        incomeLineTypeId: undefined,
        longStayId: leaseId,
        rentPeriodKey: undefined,
        reservationId: undefined,
        transactionDate: "2026-02-10",
        unitId: null,
      },
      ok: true,
    });
  });

  test("ignores optional incomeLineTypeId when longStayId is set", () => {
    const parsed = parseCreateIncomeLineBody({
      amount: 1500,
      incomeLineTypeId: miscTypeId,
      longStayId: leaseId,
      transactionDate: "2026-02-10",
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.body.incomeLineTypeId).toBeUndefined();
      expect(parsed.body.longStayId).toBe(leaseId);
    }
  });
});
