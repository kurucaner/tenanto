import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyLongStay } from "@/packages/shared";
import { LeaseTermsEditBlockReason, PropertyLongStayStatus } from "@/packages/shared";

const mockFindById = mock((): Promise<IPropertyLongStay | null> => Promise.resolve(null));
const mockGetTermsEditSignals = mock(
  (): Promise<{
    leaseStartDate: string;
    signals: {
      hasIncomeLines: boolean;
      hasRentPeriodHistory: boolean;
      hasSucceededPayments: boolean;
    };
  } | null> => Promise.resolve(null)
);

mock.module("@/db/property-long-stays", () => ({
  LongStayNotFoundError: class LongStayNotFoundError extends Error {
    constructor() {
      super("Long stay not found");
      this.name = "LongStayNotFoundError";
    }
  },
  propertyLongStaysDb: {
    findById: mockFindById,
    getTermsEditSignals: mockGetTermsEditSignals,
  },
}));

const { assertLeaseTermsEditable, getLeaseTermsEditability } =
  await import("./lease-terms-edit-service");

function makeLease(overrides: Partial<IPropertyLongStay> = {}): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Tenant A",
    id: "lease-1",
    leaseEndDate: "2027-01-01",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "property-1",
    secondaryTenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenantEmail: null,
    tenantPhone: null,
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getLeaseTermsEditability", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockGetTermsEditSignals.mockReset();
  });

  test("returns null when lease is missing", async () => {
    mockFindById.mockResolvedValueOnce(null);

    await expect(getLeaseTermsEditability("lease-1")).resolves.toBeNull();
  });

  test("returns editable when all gates pass", async () => {
    mockFindById.mockResolvedValueOnce(makeLease());
    mockGetTermsEditSignals.mockResolvedValueOnce({
      leaseStartDate: "2026-01-01",
      signals: {
        hasIncomeLines: false,
        hasRentPeriodHistory: false,
        hasSucceededPayments: false,
      },
    });

    await expect(getLeaseTermsEditability("lease-1")).resolves.toEqual({ editable: true });
  });

  test("returns block reason from signals", async () => {
    mockFindById.mockResolvedValueOnce(makeLease());
    mockGetTermsEditSignals.mockResolvedValueOnce({
      leaseStartDate: "2026-01-01",
      signals: {
        hasIncomeLines: true,
        hasRentPeriodHistory: false,
        hasSucceededPayments: false,
      },
    });

    await expect(getLeaseTermsEditability("lease-1")).resolves.toEqual({
      editable: false,
      reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES,
    });
  });
});

describe("assertLeaseTermsEditable", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockGetTermsEditSignals.mockReset();
  });

  test("throws LeaseTermsNotEditableError when blocked", async () => {
    mockFindById.mockResolvedValueOnce(makeLease());
    mockGetTermsEditSignals.mockResolvedValueOnce({
      leaseStartDate: "2026-01-01",
      signals: {
        hasIncomeLines: false,
        hasRentPeriodHistory: false,
        hasSucceededPayments: true,
      },
    });

    await expect(assertLeaseTermsEditable("lease-1")).rejects.toMatchObject({
      name: "LeaseTermsNotEditableError",
      reason: LeaseTermsEditBlockReason.HAS_SUCCEEDED_PAYMENTS,
    });
  });

  test("resolves when lease terms are editable", async () => {
    mockFindById.mockResolvedValueOnce(makeLease());
    mockGetTermsEditSignals.mockResolvedValueOnce({
      leaseStartDate: "2026-01-01",
      signals: {
        hasIncomeLines: false,
        hasRentPeriodHistory: false,
        hasSucceededPayments: false,
      },
    });

    await expect(assertLeaseTermsEditable("lease-1")).resolves.toBeUndefined();
  });
});
