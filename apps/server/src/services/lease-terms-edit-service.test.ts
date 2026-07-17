import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyLongStay } from "@/packages/shared";
import { LeaseTermsEditBlockReason, PropertyLongStayStatus } from "@/packages/shared";

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
const mockUpdateTerms = mock((): Promise<IPropertyLongStay> => Promise.resolve(makeLease()));

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
    updateTerms: mockUpdateTerms,
  },
}));

const {
  assertLeaseTermsEditable,
  editLeaseTerms,
  getLeaseTermsEditability,
  LeaseTermsNotEditableError,
  LeaseTermsValidationError,
} = await import("./lease-terms-edit-service");

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

function mockEditableLease(lease: IPropertyLongStay = makeLease()): void {
  mockFindById.mockResolvedValue(lease);
  mockGetTermsEditSignals.mockResolvedValue({
    leaseStartDate: lease.leaseStartDate,
    signals: {
      hasIncomeLines: false,
      hasRentPeriodHistory: false,
      hasSucceededPayments: false,
    },
  });
}

describe("editLeaseTerms", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockGetTermsEditSignals.mockReset();
    mockUpdateTerms.mockReset();
  });

  test("updates terms when lease is editable and body is valid", async () => {
    const lease = makeLease();
    mockEditableLease(lease);
    const updatedLease = makeLease({
      leaseEndDate: "2026-08-31",
      leaseStartDate: "2026-02-01",
      monthlyRent: 1800,
      termMonths: 7,
    });
    mockUpdateTerms.mockResolvedValueOnce(updatedLease);

    const body = {
      leaseStartDate: "2026-02-01",
      monthlyRent: 1800,
      termMonths: 7,
    };

    await expect(editLeaseTerms("lease-1", body)).resolves.toEqual(updatedLease);
    expect(mockUpdateTerms).toHaveBeenCalledWith("lease-1", body);
  });

  test("rejects ended leases", async () => {
    mockEditableLease(makeLease({ status: PropertyLongStayStatus.ENDED }));

    await expect(
      editLeaseTerms("lease-1", {
        leaseStartDate: "2026-02-01",
        monthlyRent: 1800,
        termMonths: 7,
      })
    ).rejects.toBeInstanceOf(LeaseTermsNotEditableError);
  });

  test("rejects leases with income lines", async () => {
    mockFindById.mockResolvedValue(makeLease());
    mockGetTermsEditSignals.mockResolvedValue({
      leaseStartDate: "2026-01-01",
      signals: {
        hasIncomeLines: true,
        hasRentPeriodHistory: false,
        hasSucceededPayments: false,
      },
    });

    await expect(
      editLeaseTerms("lease-1", {
        leaseStartDate: "2026-02-01",
        monthlyRent: 1800,
        termMonths: 7,
      })
    ).rejects.toMatchObject({
      reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES,
    });
  });

  test("rejects leases with succeeded payments", async () => {
    mockFindById.mockResolvedValue(makeLease());
    mockGetTermsEditSignals.mockResolvedValue({
      leaseStartDate: "2026-01-01",
      signals: {
        hasIncomeLines: false,
        hasRentPeriodHistory: false,
        hasSucceededPayments: true,
      },
    });

    await expect(
      editLeaseTerms("lease-1", {
        leaseStartDate: "2026-02-01",
        monthlyRent: 1800,
        termMonths: 7,
      })
    ).rejects.toMatchObject({
      reason: LeaseTermsEditBlockReason.HAS_SUCCEEDED_PAYMENTS,
    });
  });

  test("rejects leases with extend rent period history", async () => {
    mockFindById.mockResolvedValue(makeLease());
    mockGetTermsEditSignals.mockResolvedValue({
      leaseStartDate: "2026-01-01",
      signals: {
        hasIncomeLines: false,
        hasRentPeriodHistory: true,
        hasSucceededPayments: false,
      },
    });

    await expect(
      editLeaseTerms("lease-1", {
        leaseStartDate: "2026-02-01",
        monthlyRent: 1800,
        termMonths: 7,
      })
    ).rejects.toMatchObject({
      reason: LeaseTermsEditBlockReason.HAS_RENT_PERIOD_HISTORY,
    });
  });

  test("rejects no-op updates", async () => {
    const lease = makeLease();
    mockEditableLease(lease);

    await expect(
      editLeaseTerms("lease-1", {
        leaseStartDate: lease.leaseStartDate,
        monthlyRent: lease.monthlyRent,
        termMonths: lease.termMonths,
      })
    ).rejects.toBeInstanceOf(LeaseTermsValidationError);
  });
});
