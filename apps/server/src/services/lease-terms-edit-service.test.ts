import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LeaseErrorCode } from "@/errors/lease-errors";
import type { IPropertyLongStay } from "@/packages/shared";
import { LeaseTermsEditBlockReason, PropertyLongStayStatus } from "@/packages/shared";
import { makeLease } from "@/test-fixtures/domain";


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
const mockUpdateTerms = mock((): Promise<IPropertyLongStay> => Promise.resolve(makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null })));

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
    mockFindById.mockResolvedValueOnce(makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null }));
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
    mockFindById.mockResolvedValueOnce(makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null }));
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
    mockFindById.mockResolvedValueOnce(makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null }));
    mockGetTermsEditSignals.mockResolvedValueOnce({
      leaseStartDate: "2026-01-01",
      signals: {
        hasIncomeLines: false,
        hasRentPeriodHistory: false,
        hasSucceededPayments: true,
      },
    });

    await expect(assertLeaseTermsEditable("lease-1")).rejects.toMatchObject({
      body: { reason: LeaseTermsEditBlockReason.HAS_SUCCEEDED_PAYMENTS },
      code: LeaseErrorCode.LEASE_TERMS_NOT_EDITABLE,
    });
  });

  test("resolves when lease terms are editable", async () => {
    mockFindById.mockResolvedValueOnce(makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null }));
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

function mockEditableLease(lease: IPropertyLongStay = makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null })): void {
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
    const lease = makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null });
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
    ).rejects.toMatchObject({ code: LeaseErrorCode.LEASE_TERMS_NOT_EDITABLE });
  });

  test("rejects leases with income lines", async () => {
    mockFindById.mockResolvedValue(makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null }));
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
      body: { reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES },
      code: LeaseErrorCode.LEASE_TERMS_NOT_EDITABLE,
    });
  });

  test("rejects leases with succeeded payments", async () => {
    mockFindById.mockResolvedValue(makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null }));
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
      body: { reason: LeaseTermsEditBlockReason.HAS_SUCCEEDED_PAYMENTS },
      code: LeaseErrorCode.LEASE_TERMS_NOT_EDITABLE,
    });
  });

  test("rejects leases with extend rent period history", async () => {
    mockFindById.mockResolvedValue(makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null }));
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
      body: { reason: LeaseTermsEditBlockReason.HAS_RENT_PERIOD_HISTORY },
      code: LeaseErrorCode.LEASE_TERMS_NOT_EDITABLE,
    });
  });

  test("rejects no-op updates", async () => {
    const lease = makeLease({ guestName: "Tenant A", leaseEndDate: "2027-01-01", tenantEmail: null });
    mockEditableLease(lease);

    await expect(
      editLeaseTerms("lease-1", {
        leaseStartDate: lease.leaseStartDate,
        monthlyRent: lease.monthlyRent,
        termMonths: lease.termMonths,
      })
    ).rejects.toMatchObject({ code: LeaseErrorCode.LEASE_TERMS_VALIDATION });
  });
});
