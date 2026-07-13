import { describe, expect, test } from "bun:test";

import {
  type IPropertyIncomeLine,
  type IPropertyReservation,
  type IPropertyUnit,
  ReservationStatus,
  UnitRentalType,
} from "@/packages/shared";

import {
  buildPropertyReportSummary,
  type IReportData,
  rollupSummaries,
} from "../services/property-report-service";

const QUERY = { from: "2026-01-01", to: "2026-01-31" };

function makeUnit(overrides: Partial<IPropertyUnit> = {}): IPropertyUnit {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    id: "unit-1",
    isDeleted: false,
    layout: "1BR",
    propertyId: "prop-1",
    rentalType: UnitRentalType.SHORT_TERM,
    unitNumber: "101",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeStay(overrides: Partial<IPropertyReservation> = {}): IPropertyReservation {
  return {
    channelCommission: 10,
    channelCommissionId: "channel-airbnb",
    channelCommissionRate: 0.1,
    channelName: "Airbnb",
    checkIn: "2026-01-05",
    checkOut: "2026-01-08",
    cleaningFee: 50,
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    excludeCleaningFromCommissionBase: false,
    excludeResortTaxFromPayout: true,
    grossIncome: 500,
    guestName: "Guest",
    id: "stay-1",
    isDeleted: false,
    netIncome: 400,
    nights: 3,
    propertyId: "prop-1",
    refundedAmount: null,
    refundedAt: null,
    refundedBy: null,
    reservationNumber: null,
    roomTotal: 450,
    status: ReservationStatus.STAYED,
    taxBreakdown: [],
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeIncomeLine(overrides: Partial<IPropertyIncomeLine> = {}): IPropertyIncomeLine {
  return {
    amount: 75,
    channelCommission: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    description: null,
    grossIncome: 75,
    guestName: null,
    id: "line-1",
    incomeLineTypeId: "type-fee",
    incomeLineTypeName: "Late fee",
    isDeleted: false,
    longStayId: null,
    netIncome: 75,
    propertyId: "prop-1",
    refundedAmount: null,
    refundedAt: null,
    refundedBy: null,
    reservationId: null,
    taxBreakdown: [],
    transactionDate: "2026-01-15",
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeReportData(overrides: Partial<IReportData> = {}): IReportData {
  return {
    expenses: [],
    incomeLines: [],
    reservations: [],
    units: [makeUnit()],
    ...overrides,
  };
}

describe("buildPropertyReportSummary taxSummary", () => {
  test("returns empty taxSummary when there are no reservations", () => {
    const summary = buildPropertyReportSummary(makeReportData(), QUERY);
    expect(summary.taxSummary).toEqual([]);
  });

  test("aggregates tax breakdown across stays by tax rate", () => {
    const summary = buildPropertyReportSummary(
      makeReportData({
        reservations: [
          makeStay({
            id: "stay-1",
            taxBreakdown: [
              { amount: 30, name: "Sales tax", rate: 0.06, taxRateId: "tax-sales" },
              { amount: 10, name: "Resort tax", rate: 0.04, taxRateId: "tax-resort" },
            ],
          }),
          makeStay({
            checkIn: "2026-01-10",
            checkOut: "2026-01-12",
            id: "stay-2",
            taxBreakdown: [{ amount: 20, name: "Sales tax", rate: 0.06, taxRateId: "tax-sales" }],
          }),
        ],
      }),
      QUERY
    );

    expect(summary.taxSummary).toEqual([
      { amount: 50, name: "Sales tax", taxRateId: "tax-sales" },
      { amount: 10, name: "Resort tax", taxRateId: "tax-resort" },
    ]);
  });
});

describe("buildPropertyReportSummary byUnit stayGrossIncome", () => {
  test("tracks stay gross separately from unit-attached other income", () => {
    const summary = buildPropertyReportSummary(
      makeReportData({
        incomeLines: [makeIncomeLine({ amount: 75, grossIncome: 75, netIncome: 75 })],
        reservations: [makeStay({ grossIncome: 500, netIncome: 400 })],
      }),
      QUERY
    );

    expect(summary.byUnit).toHaveLength(1);
    expect(summary.byUnit[0]).toMatchObject({
      grossIncome: 575,
      stayGrossIncome: 500,
    });
  });
});

describe("buildPropertyReportSummary refunds", () => {
  test("excludes refunded stays from totals", () => {
    const summary = buildPropertyReportSummary(
      makeReportData({
        reservations: [
          makeStay({ grossIncome: 500, netIncome: 400 }),
          makeStay({
            grossIncome: 300,
            id: "stay-refunded",
            netIncome: 250,
            refundedAmount: 300,
            refundedAt: "2026-03-01T00:00:00.000Z",
          }),
        ],
      }),
      QUERY
    );

    expect(summary.totals).toMatchObject({
      grossIncome: 500,
      netIncome: 400,
    });
  });

  test("excludes refunded income lines from totals", () => {
    const summary = buildPropertyReportSummary(
      makeReportData({
        incomeLines: [
          makeIncomeLine({ amount: 75, grossIncome: 75, netIncome: 75 }),
          makeIncomeLine({
            amount: 50,
            grossIncome: 50,
            id: "line-refunded",
            netIncome: 50,
            refundedAmount: 50,
            refundedAt: "2026-03-01T00:00:00.000Z",
          }),
        ],
      }),
      QUERY
    );

    expect(summary.totals).toMatchObject({
      grossIncome: 75,
      netIncome: 75,
    });
  });

  test("includes remaining amounts for partially refunded stays", () => {
    const summary = buildPropertyReportSummary(
      makeReportData({
        reservations: [
          makeStay({ grossIncome: 500, netIncome: 400 }),
          makeStay({
            grossIncome: 400,
            id: "stay-partial",
            netIncome: 300,
            refundedAmount: 100,
            refundedAt: "2026-03-01T00:00:00.000Z",
          }),
        ],
      }),
      QUERY
    );

    expect(summary.totals).toMatchObject({
      grossIncome: 800,
      netIncome: 625,
    });
  });

  test("includes remaining amounts for partially refunded income lines", () => {
    const summary = buildPropertyReportSummary(
      makeReportData({
        incomeLines: [
          makeIncomeLine({ amount: 100, grossIncome: 100, netIncome: 100 }),
          makeIncomeLine({
            amount: 80,
            grossIncome: 80,
            id: "line-partial",
            netIncome: 80,
            refundedAmount: 20,
            refundedAt: "2026-03-01T00:00:00.000Z",
          }),
        ],
      }),
      QUERY
    );

    expect(summary.totals).toMatchObject({
      grossIncome: 160,
      netIncome: 160,
    });
  });
});

describe("rollupSummaries taxSummary", () => {
  test("merges tax rows across property summaries", () => {
    const first = buildPropertyReportSummary(
      makeReportData({
        reservations: [
          makeStay({
            taxBreakdown: [{ amount: 15, name: "Sales tax", rate: 0.06, taxRateId: "tax-sales" }],
          }),
        ],
      }),
      QUERY
    );

    const second = buildPropertyReportSummary(
      makeReportData({
        reservations: [
          makeStay({
            id: "stay-2",
            taxBreakdown: [
              { amount: 25, name: "Sales tax", rate: 0.06, taxRateId: "tax-sales" },
              { amount: 5, name: "City tax", rate: 0.02, taxRateId: "tax-city" },
            ],
            unitId: "unit-2",
          }),
        ],
        units: [makeUnit({ id: "unit-2", unitNumber: "102" })],
      }),
      QUERY
    );

    const rolledUp = rollupSummaries([first, second], QUERY);

    expect(rolledUp.taxSummary).toEqual([
      { amount: 40, name: "Sales tax", taxRateId: "tax-sales" },
      { amount: 5, name: "City tax", taxRateId: "tax-city" },
    ]);
  });
});
