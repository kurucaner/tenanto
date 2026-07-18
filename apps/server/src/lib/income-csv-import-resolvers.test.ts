import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PROPERTY_CHANNEL_COMMISSIONS,
  type IPropertyChannelCommission,
  ReservationStatus,
  UnitRentalType,
} from "@/packages/shared";
import { makeUnit } from "@/test-fixtures/domain";

import {
  buildIncomeImportParsedRow,
  resolveChannelByCsvName,
  resolveUnitByRoomNo,
} from "./income-csv-import-resolvers";

const units = [
  makeUnit({
    id: "unit-210",
    layout: "studio",
    propertyId: "property-1",
    rentalType: UnitRentalType.SHORT_TERM,
    unitNumber: "210",
  }),
  makeUnit({
    id: "unit-abbott",
    layout: "2br",
    propertyId: "property-1",
    rentalType: UnitRentalType.SHORT_TERM,
    unitNumber: "Abbott 3",
  }),
];

const channels: IPropertyChannelCommission[] = DEFAULT_PROPERTY_CHANNEL_COMMISSIONS.map(
  (channel, index) => ({
    excludeCleaningFromCommissionBase: channel.excludeCleaningFromCommissionBase ?? false,
    excludeResortTaxFromPayout: channel.excludeResortTaxFromPayout ?? false,
    id: `channel-${index}`,
    name: channel.name,
    propertyId: "property-1",
    rate: channel.rate,
    sortOrder: index,
  })
);

describe("resolveUnitByRoomNo", () => {
  test("matches unit numbers case-insensitively", () => {
    expect(resolveUnitByRoomNo("210", units)?.id).toBe("unit-210");
    expect(resolveUnitByRoomNo("abbott 3", units)?.id).toBe("unit-abbott");
  });
});

describe("resolveChannelByCsvName", () => {
  test("resolves aliases from the Hotel Tax Calculator export", () => {
    expect(resolveChannelByCsvName("Booking", channels)?.name).toBe("Booking.com");
    expect(resolveChannelByCsvName("Airbnb", channels)?.name).toBe("Airbnb");
    expect(resolveChannelByCsvName("Direct", channels)?.name).toBe("Direct web / merchant");
    expect(resolveChannelByCsvName("Expedia EC", channels)?.name).toBe("Expedia");
  });
});

describe("buildIncomeImportParsedRow", () => {
  test("builds a valid parsed row with computed financials", () => {
    const row = buildIncomeImportParsedRow(
      {
        channelName: "Booking",
        checkIn: "2026-02-07",
        checkOut: "2026-02-08",
        cleaningFee: 0,
        guestName: "Alexandar Kopilovic",
        nights: 1,
        refunded: false,
        roomNo: "210",
        roomTotal: 121.63,
        rowIndex: 2,
        sourceFileName: "hotel-tax-calculator.csv",
        status: ReservationStatus.STAYED,
      },
      { channels, taxRates: [], units }
    );

    expect(row.validationError).toBeUndefined();
    expect(row.unitId).toBe("unit-210");
    expect(row.channelCommissionId).toBe("channel-1");
    expect(row.computedNights).toBe(1);
    expect(row.grossIncome).toBeGreaterThan(0);
    expect(row.netIncome).toBeGreaterThan(0);
  });

  test("flags missing unit and channel", () => {
    const row = buildIncomeImportParsedRow(
      {
        channelName: "Unknown Channel",
        checkIn: "2026-02-07",
        checkOut: "2026-02-08",
        cleaningFee: 0,
        guestName: "Guest",
        nights: 1,
        refunded: false,
        roomNo: "999",
        roomTotal: 100,
        rowIndex: 3,
        sourceFileName: "hotel-tax-calculator.csv",
        status: ReservationStatus.STAYED,
      },
      { channels, taxRates: [], units }
    );

    expect(row.validationError).toContain('Unit "999" not found');
    expect(row.validationError).toContain('Channel "Unknown Channel" not found');
  });

  test("flags refund rows that conflict with booking status", () => {
    const row = buildIncomeImportParsedRow(
      {
        channelName: "Booking",
        checkIn: "2026-02-07",
        checkOut: "2026-02-08",
        cleaningFee: 0,
        guestName: "Guest",
        nights: 1,
        refunded: true,
        roomNo: "210",
        roomTotal: 0,
        rowIndex: 4,
        sourceFileName: "hotel-tax-calculator.csv",
        status: ReservationStatus.CANCELED,
      },
      { channels, taxRates: [], units }
    );

    expect(row.validationError).toContain("Refunded stays cannot be canceled or no-show");
    expect(row.validationError).toContain('Refunded stays must have status "stayed"');
  });
});
