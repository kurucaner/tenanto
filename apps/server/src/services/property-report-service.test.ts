import { describe, expect, test } from "bun:test";

import {
  type IPropertyReservation,
  type IPropertyUnit,
  ReservationChannel,
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
    channel: ReservationChannel.AIRBNB,
    channelCommission: 10,
    channelCommissionRate: 0.1,
    checkIn: "2026-01-05",
    checkOut: "2026-01-08",
    cleaningFee: 50,
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    grossIncome: 500,
    guestName: "Guest",
    id: "stay-1",
    isDeleted: false,
    netIncome: 400,
    nights: 3,
    propertyId: "prop-1",
    reservationNumber: null,
    roomTotal: 450,
    status: ReservationStatus.STAYED,
    taxBreakdown: [],
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
