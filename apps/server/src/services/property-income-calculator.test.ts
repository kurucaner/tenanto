import { describe, expect, test } from "bun:test";

import {
  getStayNetPayout,
  type IPropertySettings,
  type IPropertyTaxRate,
  ReservationChannel,
  UnitRentalType,
} from "@/packages/shared";
import { calculateStayIncome } from "@/services/property-income-calculator";

const SETTINGS = {
  airbnbCommissionRate: 0.155,
  bookingCommissionRate: 0.15,
  directCommissionRate: 0.035,
  expediaCommissionRate: 0.15,
} as IPropertySettings;

const TAX_RATES: IPropertyTaxRate[] = [
  { id: "tax-sales", name: "Sales tax", propertyId: "prop-1", rate: 0.06, sortOrder: 1 },
  { id: "tax-resort", name: "Resort tax", propertyId: "prop-1", rate: 0.04, sortOrder: 2 },
];

// base = 100 * 10 + 0 = 1000; salesTax = 60; resortTax = 40; totalTaxes = 100.
function calc(channel: (typeof ReservationChannel)[keyof typeof ReservationChannel], taxRates = TAX_RATES) {
  return calculateStayIncome({
    channel,
    cleaningFee: 0,
    nights: 10,
    roomTotal: 1000,
    settings: SETTINGS,
    taxRates,
    unitRentalType: UnitRentalType.SHORT_TERM,
  });
}

describe("calculateStayIncome — Airbnb resort tax exclusion", () => {
  test("Airbnb excludes resort tax from gross and payout", () => {
    const result = calc(ReservationChannel.AIRBNB);
    const stay = { netIncome: result.netIncome, taxBreakdown: result.taxBreakdown };

    // commission = 1000 * 0.155 = 155
    expect(result.channelCommission).toBe(155);
    // gross = base + (totalTaxes - resortTax) = 1000 + (100 - 40) = 1060
    expect(result.grossIncome).toBe(1060);
    // netIncome = base - totalTaxes - commission - resortTax = 1000 - 100 - 155 - 40 = 705
    expect(result.netIncome).toBe(705);
    // Net Payout = netIncome + totalTaxes = base - commission - resortTax = 805
    expect(getStayNetPayout(stay)).toBe(805);
  });

  test("non-Airbnb channels are unchanged (resort tax stays in gross)", () => {
    const result = calc(ReservationChannel.BOOKING);
    // commission = 1000 * 0.15 = 150
    expect(result.channelCommission).toBe(150);
    // gross = base + totalTaxes = 1100
    expect(result.grossIncome).toBe(1100);
    // netIncome = base - totalTaxes - commission = 1000 - 100 - 150 = 750
    expect(result.netIncome).toBe(750);
    expect(getStayNetPayout({ netIncome: result.netIncome, taxBreakdown: result.taxBreakdown })).toBe(850);
  });

  test("Airbnb with no resort tax is unchanged", () => {
    const salesOnly = [TAX_RATES[0]] as IPropertyTaxRate[];
    const result = calc(ReservationChannel.AIRBNB, salesOnly);
    // totalTaxes = 60, no resort adjustment
    expect(result.grossIncome).toBe(1060);
    expect(result.netIncome).toBe(785);
  });
});
