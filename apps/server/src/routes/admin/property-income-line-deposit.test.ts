import { beforeEach, describe, expect, mock, test } from "bun:test";

import { SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME } from "@/packages/shared";
import { mockAsyncFn } from "@/test-fixtures/mocks";

const mockEnsureLeaseDepositIncomeLineType = mockAsyncFn(() =>
  Promise.resolve({
    id: "type-system-deposit",
    name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
    propertyId: "property-1",
    sortOrder: -2,
  })
);
const mockEnsureLeaseRentIncomeLineType = mockAsyncFn(() =>
  Promise.resolve({
    id: "type-system-rent",
    name: "Long-term rent",
    propertyId: "property-1",
    sortOrder: -1,
  })
);

mock.module("@/db/property-income-line-types", () => ({
  propertyIncomeLineTypesDb: {
    ensureLeaseDepositIncomeLineType: mockEnsureLeaseDepositIncomeLineType,
    ensureLeaseRentIncomeLineType: mockEnsureLeaseRentIncomeLineType,
  },
}));

const { parseCreateIncomeLineBody } = await import("@/lib/parse-create-income-line-body");
const { resolveLeaseIncomeLineSystemType } =
  await import("@/lib/resolve-lease-income-line-system-type");

const leaseId = "00000000-0000-4000-8000-000000000002";

describe("POST income-lines security deposit", () => {
  beforeEach(() => {
    mockEnsureLeaseDepositIncomeLineType.mockClear();
    mockEnsureLeaseRentIncomeLineType.mockClear();
  });

  test("parses deposit intent with longStayId and no rent period", () => {
    const parsed = parseCreateIncomeLineBody({
      amount: 1500,
      isSecurityDeposit: true,
      longStayId: leaseId,
      transactionDate: "2026-02-10",
    });

    expect(parsed).toEqual({
      body: {
        amount: 1500,
        description: undefined,
        guestName: undefined,
        incomeLineTypeId: undefined,
        isSecurityDeposit: true,
        longStayId: leaseId,
        rentPeriodKey: undefined,
        reservationId: undefined,
        transactionDate: "2026-02-10",
        unitId: null,
      },
      ok: true,
    });
  });

  test("rejects deposit intent without longStayId", () => {
    const parsed = parseCreateIncomeLineBody({
      amount: 1500,
      incomeLineTypeId: "00000000-0000-4000-8000-000000000001",
      isSecurityDeposit: true,
      transactionDate: "2026-02-10",
    });

    expect(parsed).toEqual({
      error: "isSecurityDeposit requires longStayId",
      ok: false,
    });
  });

  test("rejects rentPeriodKey on deposit lines", () => {
    const parsed = parseCreateIncomeLineBody({
      amount: 1500,
      isSecurityDeposit: true,
      longStayId: leaseId,
      rentPeriodKey: "2026-02",
      transactionDate: "2026-02-10",
    });

    expect(parsed).toEqual({
      error: "Security deposit income lines cannot include a rent period",
      ok: false,
    });
  });

  test("rejects rentPeriodMonth on deposit lines", () => {
    const parsed = parseCreateIncomeLineBody({
      amount: 1500,
      isSecurityDeposit: true,
      longStayId: leaseId,
      rentPeriodMonth: "2026-02",
      transactionDate: "2026-02-10",
    });

    expect(parsed).toEqual({
      error: "Security deposit income lines cannot include a rent period",
      ok: false,
    });
  });

  test("resolves Security deposit system type for deposit intent", async () => {
    const type = await resolveLeaseIncomeLineSystemType("property-1", true);

    expect(mockEnsureLeaseDepositIncomeLineType).toHaveBeenCalledWith("property-1");
    expect(mockEnsureLeaseRentIncomeLineType).not.toHaveBeenCalled();
    expect(type).toEqual({
      id: "type-system-deposit",
      name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
      propertyId: "property-1",
      sortOrder: -2,
    });
  });

  test("resolves Long-term rent system type when deposit intent is absent", async () => {
    const type = await resolveLeaseIncomeLineSystemType("property-1", undefined);

    expect(mockEnsureLeaseRentIncomeLineType).toHaveBeenCalledWith("property-1");
    expect(mockEnsureLeaseDepositIncomeLineType).not.toHaveBeenCalled();
    expect(type.id).toBe("type-system-rent");
  });
});
