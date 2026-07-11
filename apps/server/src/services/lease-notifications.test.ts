import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyLongStay } from "@/packages/shared";
import { PropertyLongStayStatus, UnitRentalType } from "@/packages/shared";

const mockFindLongStayById = mock(() => Promise.resolve(null as IPropertyLongStay | null));
const mockFindPropertyById = mock(() =>
  Promise.resolve({
    address: "123 Main St",
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "prop-1",
    legalName: null,
    name: "Sunset Apartments",
    phoneNumber: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
);
const mockFindUnitById = mock(() =>
  Promise.resolve({
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    id: "unit-1",
    isDeleted: false,
    layout: "2+1",
    propertyId: "prop-1",
    rentalType: UnitRentalType.LONG_TERM,
    unitNumber: "101",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
);
const mockSendRentPaymentRecordedEmail = mock(() => Promise.resolve());

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: {
    findById: mockFindLongStayById,
  },
}));

mock.module("@/db/properties", () => ({
  propertiesDb: {
    findById: mockFindPropertyById,
  },
}));

mock.module("@/db/property-units", () => ({
  propertyUnitsDb: {
    findById: mockFindUnitById,
  },
}));

mock.module("@/ses/transactional-emails", () => ({
  sendRentPaymentRecordedEmail: mockSendRentPaymentRecordedEmail,
}));

const { notifyPrimaryTenantRentRecorded } = await import("./lease-notifications");

function makeLease(
  overrides: Partial<IPropertyLongStay> = {}
): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Jane Tenant",
    id: "lease-1",
    leaseEndDate: "2027-01-01",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "prop-1",
    secondaryTenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenantEmail: "jane@example.com",
    tenantPhone: null,
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("notifyPrimaryTenantRentRecorded", () => {
  beforeEach(() => {
    mockFindLongStayById.mockClear();
    mockFindPropertyById.mockClear();
    mockFindUnitById.mockClear();
    mockSendRentPaymentRecordedEmail.mockClear();
  });

  test("sends email when lease has tenant email and related records resolve", async () => {
    mockFindLongStayById.mockResolvedValueOnce(makeLease());

    await notifyPrimaryTenantRentRecorded({
      amount: 1500,
      longStayId: "lease-1",
      propertyId: "prop-1",
      transactionDate: "2026-03-15",
    });

    expect(mockSendRentPaymentRecordedEmail).toHaveBeenCalledTimes(1);
    expect(mockSendRentPaymentRecordedEmail).toHaveBeenCalledWith("jane@example.com", {
      amount: "$1,500.00",
      paymentDate: "March 15, 2026",
      propertyName: "Sunset Apartments",
      rentMonthLabel: "March 2026",
      tenantName: "Jane Tenant",
      unitLabel: "Unit 101",
    });
  });

  test("no-ops when tenant email is missing", async () => {
    mockFindLongStayById.mockResolvedValueOnce(makeLease({ tenantEmail: null }));

    await notifyPrimaryTenantRentRecorded({
      amount: 1500,
      longStayId: "lease-1",
      propertyId: "prop-1",
      transactionDate: "2026-03-15",
    });

    expect(mockSendRentPaymentRecordedEmail).not.toHaveBeenCalled();
  });

  test("no-ops when tenant email is blank", async () => {
    mockFindLongStayById.mockResolvedValueOnce(makeLease({ tenantEmail: "   " }));

    await notifyPrimaryTenantRentRecorded({
      amount: 1500,
      longStayId: "lease-1",
      propertyId: "prop-1",
      transactionDate: "2026-03-15",
    });

    expect(mockSendRentPaymentRecordedEmail).not.toHaveBeenCalled();
  });

  test("no-ops when lease is not found", async () => {
    mockFindLongStayById.mockResolvedValueOnce(null);

    await notifyPrimaryTenantRentRecorded({
      amount: 1500,
      longStayId: "lease-1",
      propertyId: "prop-1",
      transactionDate: "2026-03-15",
    });

    expect(mockSendRentPaymentRecordedEmail).not.toHaveBeenCalled();
  });

  test("no-ops when lease belongs to a different property", async () => {
    mockFindLongStayById.mockResolvedValueOnce(makeLease({ propertyId: "prop-2" }));

    await notifyPrimaryTenantRentRecorded({
      amount: 1500,
      longStayId: "lease-1",
      propertyId: "prop-1",
      transactionDate: "2026-03-15",
    });

    expect(mockSendRentPaymentRecordedEmail).not.toHaveBeenCalled();
  });
});
