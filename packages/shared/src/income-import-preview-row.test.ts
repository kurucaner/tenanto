import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PROPERTY_CHANNEL_COMMISSIONS,
  type IPropertyChannelCommission,
  type IPropertyTaxRate,
  type IPropertyUnit,
  recomputeIncomeImportPreviewRow,
  ReservationStatus,
  UnitRentalType,
} from "./index";

const units: IPropertyUnit[] = [
  {
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    id: "unit-210",
    isDeleted: false,
    layout: "studio",
    propertyId: "property-1",
    rentalType: UnitRentalType.SHORT_TERM,
    unitNumber: "210",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
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

const taxRates: IPropertyTaxRate[] = [
  {
    id: "tax-sales",
    name: "Sales tax",
    propertyId: "property-1",
    rate: 0.06,
    sortOrder: 1,
  },
];

describe("recomputeIncomeImportPreviewRow refund rules", () => {
  test("accepts refunded stayed rows including zero-amount refunds", () => {
    const row = recomputeIncomeImportPreviewRow(
      {
        channelCommissionId: "channel-1",
        checkIn: "2026-02-07",
        checkOut: "2026-02-08",
        cleaningFee: 0,
        guestName: "Refund Guest",
        nights: 1,
        refunded: true,
        roomTotal: 0,
        rowIndex: 1,
        sourceFileName: "hotel-tax-calculator.csv",
        status: ReservationStatus.STAYED,
        unitId: "unit-210",
      },
      { channels, taxRates, units }
    );

    expect(row.validationError).toBeUndefined();
    expect(row.refunded).toBe(true);
    expect(row.status).toBe(ReservationStatus.STAYED);
    expect(row.netIncome).toBe(0);
    expect(row.grossIncome).toBe(0);
  });

  test("rejects refunded rows with canceled or no-show status", () => {
    const canceled = recomputeIncomeImportPreviewRow(
      {
        channelCommissionId: "channel-1",
        checkIn: "2026-02-07",
        checkOut: "2026-02-08",
        cleaningFee: 0,
        guestName: "Refund Guest",
        nights: 1,
        refunded: true,
        roomTotal: 0,
        rowIndex: 2,
        sourceFileName: "hotel-tax-calculator.csv",
        status: ReservationStatus.CANCELED,
        unitId: "unit-210",
      },
      { channels, taxRates, units }
    );

    expect(canceled.validationError).toContain("Refunded stays cannot be canceled or no-show");
    expect(canceled.validationError).toContain('Refunded stays must have status "stayed"');
    expect(canceled.status).toBe(ReservationStatus.CANCELED);
  });
});
