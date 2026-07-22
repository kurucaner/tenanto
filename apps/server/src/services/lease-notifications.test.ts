import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type {
  ILeaseDepositSummary,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
} from "@/packages/shared";
import {
  LeaseDepositBalanceStatus,
  PropertyLongStayStatus,
  RentBillingCadence,
  UnitRentalType,
} from "@/packages/shared";
import type {
  LeaseEndedEmailOptions,
  RentPaymentRecordedEmailOptions,
} from "@/ses/transactional-emails";
import * as transactionalEmails from "@/ses/transactional-emails";
import { makeLease } from "@/test-fixtures/domain";
import {
  getMockCallArg,
  mockAsyncFn,
  mockResolvedEmpty,
  mockResolvedNull,
} from "@/test-fixtures/mocks";

const emptyDepositSummary: ILeaseDepositSummary = {
  collected: 0,
  expected: null,
  outstanding: 0,
  status: LeaseDepositBalanceStatus.NONE,
};

const mockFindLongStayById = mockResolvedNull<IPropertyLongStay>();
const mockGetRentSchedule = mockResolvedEmpty<IPropertyLongStayRentMonth>();
const mockLoadLeaseDepositSummary = mockAsyncFn(
  (_lease: Pick<IPropertyLongStay, "id" | "propertyId" | "securityDepositAmount">) =>
    Promise.resolve(emptyDepositSummary)
);
const mockFindPropertyById = mockAsyncFn(() =>
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
const mockFindUnitById = mockAsyncFn(() =>
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
const mockSendRentPaymentRecordedEmail = mockAsyncFn(
  (_to: string, _opts: RentPaymentRecordedEmailOptions) => Promise.resolve(true)
);
const mockSendLeaseEndedEmail = mockAsyncFn((_to: string, _opts: LeaseEndedEmailOptions) =>
  Promise.resolve(true)
);

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: {
    findById: mockFindLongStayById,
    getRentSchedule: mockGetRentSchedule,
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

mock.module("@/lib/lease-deposit-summary", () => ({
  loadLeaseDepositSummary: mockLoadLeaseDepositSummary,
}));

mock.module("@/ses/transactional-emails", () => ({
  ...transactionalEmails,
  sendLeaseEndedEmail: mockSendLeaseEndedEmail,
  sendRentPaymentRecordedEmail: mockSendRentPaymentRecordedEmail,
}));

const { notifyPrimaryTenantLeaseEnded, notifyPrimaryTenantRentRecorded } =
  await import("./lease-notifications");

describe("notifyPrimaryTenantRentRecorded", () => {
  const originalFlag = process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;

  beforeEach(() => {
    process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = "true";
    mockFindLongStayById.mockClear();
    mockFindPropertyById.mockClear();
    mockFindUnitById.mockClear();
    mockSendRentPaymentRecordedEmail.mockClear();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;
    } else {
      process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = originalFlag;
    }
  });

  test("sends email when lease has tenant email and related records resolve", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({ leaseEndDate: "2027-01-01", propertyId: "prop-1" })
    );

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
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({ propertyId: "prop-1", tenantEmail: null })
    );

    await notifyPrimaryTenantRentRecorded({
      amount: 1500,
      longStayId: "lease-1",
      propertyId: "prop-1",
      transactionDate: "2026-03-15",
    });

    expect(mockSendRentPaymentRecordedEmail).not.toHaveBeenCalled();
  });

  test("no-ops when tenant email is blank", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({ propertyId: "prop-1", tenantEmail: "   " })
    );

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

describe("notifyPrimaryTenantLeaseEnded", () => {
  const originalFlag = process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;

  beforeEach(() => {
    process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = "true";
    mockFindLongStayById.mockClear();
    mockGetRentSchedule.mockClear();
    mockLoadLeaseDepositSummary.mockClear();
    mockLoadLeaseDepositSummary.mockResolvedValue(emptyDepositSummary);
    mockFindPropertyById.mockClear();
    mockFindUnitById.mockClear();
    mockSendLeaseEndedEmail.mockClear();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;
    } else {
      process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = originalFlag;
    }
  });

  test("sends holdover email with prorated final month and unpaid status", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({
        actualEndDate: "2024-07-05",
        leaseEndDate: "2024-06-30",
        propertyId: "prop-1",
        status: PropertyLongStayStatus.ENDED,
      })
    );
    mockGetRentSchedule.mockResolvedValueOnce([
      {
        daysInMonth: 31,
        expectedRent: 161.29,
        isPaid: false,
        isProrated: true,
        occupiedDays: 5,
        paidRent: 0,
        periodKey: "2024-07",
        remainingRent: 161.29,
      },
    ]);

    await notifyPrimaryTenantLeaseEnded({
      longStayId: "lease-1",
      propertyId: "prop-1",
    });

    expect(mockSendLeaseEndedEmail).toHaveBeenCalledTimes(1);
    expect(mockSendLeaseEndedEmail).toHaveBeenCalledWith("jane@example.com", {
      contractEndDate: "June 30, 2024",
      depositPlain: "",
      depositSection: "",
      finalMonthPlain: "Final rent month: July 2024\nAmount: $161.29\nDays billed: 5/31 days",
      finalMonthSection: expect.stringContaining("Final rent month:"),
      holdoverPlain:
        "Your contract ended on June 30, 2024, and your move-out was recorded on July 5, 2024. Holdover days are included in the final month's prorated rent.",
      holdoverSection: expect.stringContaining("Holdover days are included"),
      leaseStartDate: "January 1, 2026",
      moveOutDate: "July 5, 2024",
      paymentStatusLine:
        "Final month rent of $161.29 is still outstanding. Please contact your property manager.",
      propertyName: "Sunset Apartments",
      tenantName: "Jane Tenant",
      unitLabel: "Unit 101",
    });
  });

  test("sends on-time end email without holdover and with paid final month", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({
        actualEndDate: "2026-03-31",
        leaseEndDate: "2026-03-31",
        propertyId: "prop-1",
        status: PropertyLongStayStatus.ENDED,
      })
    );
    mockGetRentSchedule.mockResolvedValueOnce([
      {
        daysInMonth: 31,
        expectedRent: 1500,
        incomeLineId: "line-mar",
        isPaid: true,
        isProrated: false,
        occupiedDays: 31,
        paidRent: 1500,
        periodKey: "2026-03",
        remainingRent: 0,
      },
    ]);

    await notifyPrimaryTenantLeaseEnded({
      longStayId: "lease-1",
      propertyId: "prop-1",
    });

    expect(mockSendLeaseEndedEmail).toHaveBeenCalledTimes(1);
    expect(mockSendLeaseEndedEmail).toHaveBeenCalledWith("jane@example.com", {
      contractEndDate: "March 31, 2026",
      depositPlain: "",
      depositSection: "",
      finalMonthPlain: "Final rent month: March 2026\nAmount: $1,500.00",
      finalMonthSection: expect.stringContaining("March 2026"),
      holdoverPlain: "",
      holdoverSection: "",
      leaseStartDate: "January 1, 2026",
      moveOutDate: "March 31, 2026",
      paymentStatusLine: "Final month rent is recorded — you're all set.",
      propertyName: "Sunset Apartments",
      tenantName: "Jane Tenant",
      unitLabel: "Unit 101",
    });
  });

  test("includes security deposit settlement copy when deposit was collected", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({
        actualEndDate: "2026-03-31",
        leaseEndDate: "2026-03-31",
        propertyId: "prop-1",
        securityDepositAmount: 1500,
        status: PropertyLongStayStatus.ENDED,
      })
    );
    mockGetRentSchedule.mockResolvedValueOnce([
      {
        daysInMonth: 31,
        expectedRent: 1500,
        incomeLineId: "line-mar",
        isPaid: true,
        isProrated: false,
        occupiedDays: 31,
        paidRent: 1500,
        periodKey: "2026-03",
        remainingRent: 0,
      },
    ]);
    mockLoadLeaseDepositSummary.mockResolvedValueOnce({
      collected: 1500,
      expected: 1500,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.HELD,
    });

    await notifyPrimaryTenantLeaseEnded({
      longStayId: "lease-1",
      propertyId: "prop-1",
    });

    expect(mockSendLeaseEndedEmail).toHaveBeenCalledTimes(1);
    const emailPayload = getMockCallArg<LeaseEndedEmailOptions>(mockSendLeaseEndedEmail, 1);
    expect(emailPayload?.depositPlain).toBe(
      "Security deposit: $1,500.00 was collected. Your property manager will settle any refund or amount withheld for damages."
    );
    expect(emailPayload?.depositSection).toContain("Security deposit: $1,500.00 was collected");
  });

  test("mentions recorded refund when deposit status is refunded", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({
        actualEndDate: "2026-03-31",
        leaseEndDate: "2026-03-31",
        propertyId: "prop-1",
        securityDepositAmount: 1500,
        status: PropertyLongStayStatus.ENDED,
      })
    );
    mockGetRentSchedule.mockResolvedValueOnce([]);
    mockLoadLeaseDepositSummary.mockResolvedValueOnce({
      collected: 1500,
      expected: 1500,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.REFUNDED,
    });

    await notifyPrimaryTenantLeaseEnded({
      longStayId: "lease-1",
      propertyId: "prop-1",
    });

    const emailPayload = getMockCallArg<LeaseEndedEmailOptions>(mockSendLeaseEndedEmail, 1);
    expect(emailPayload?.depositPlain).toContain("a refund has been recorded");
  });

  test("sends weekly end email with week period label and holdover copy", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({
        actualEndDate: "2026-01-23",
        leaseEndDate: "2026-01-20",
        leaseStartDate: "2026-01-15",
        propertyId: "prop-1",
        rentBillingCadence: RentBillingCadence.WEEKLY,
        status: PropertyLongStayStatus.ENDED,
      })
    );
    mockGetRentSchedule.mockResolvedValueOnce([
      {
        daysInMonth: 7,
        expectedRent: 400,
        incomeLineId: "line-jan",
        isPaid: false,
        isProrated: true,
        occupiedDays: 4,
        paidRent: 0,
        periodKey: "2026-01-22",
        remainingRent: 400,
      },
    ]);

    await notifyPrimaryTenantLeaseEnded({
      longStayId: "lease-1",
      propertyId: "prop-1",
    });

    expect(mockSendLeaseEndedEmail).toHaveBeenCalledTimes(1);
    const emailPayload = getMockCallArg<LeaseEndedEmailOptions>(mockSendLeaseEndedEmail, 1);
    expect(emailPayload).toMatchObject({
      contractEndDate: "January 20, 2026",
      holdoverPlain: expect.stringContaining("final week's prorated rent"),
      leaseStartDate: "January 15, 2026",
      moveOutDate: "January 23, 2026",
      paymentStatusLine:
        "Final week rent of $400.00 is still outstanding. Please contact your property manager.",
      propertyName: "Sunset Apartments",
      tenantName: "Jane Tenant",
      unitLabel: "Unit 101",
    });
    expect(emailPayload?.finalMonthPlain).toContain("Final rent week:");
    expect(emailPayload?.finalMonthPlain).toMatch(/Week of /);
  });

  test("no-ops when tenant email is missing", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({
        actualEndDate: "2026-03-31",
        propertyId: "prop-1",
        status: PropertyLongStayStatus.ENDED,
        tenantEmail: null,
      })
    );

    await notifyPrimaryTenantLeaseEnded({
      longStayId: "lease-1",
      propertyId: "prop-1",
    });

    expect(mockSendLeaseEndedEmail).not.toHaveBeenCalled();
  });

  test("no-ops when lease is not found", async () => {
    mockFindLongStayById.mockResolvedValueOnce(null);

    await notifyPrimaryTenantLeaseEnded({
      longStayId: "lease-1",
      propertyId: "prop-1",
    });

    expect(mockSendLeaseEndedEmail).not.toHaveBeenCalled();
  });

  test("no-ops when lease belongs to a different property", async () => {
    mockFindLongStayById.mockResolvedValueOnce(
      makeLease({
        actualEndDate: "2026-03-31",
        propertyId: "prop-2",
        status: PropertyLongStayStatus.ENDED,
      })
    );

    await notifyPrimaryTenantLeaseEnded({
      longStayId: "lease-1",
      propertyId: "prop-1",
    });

    expect(mockSendLeaseEndedEmail).not.toHaveBeenCalled();
  });
});
