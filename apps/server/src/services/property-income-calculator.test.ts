import { describe, expect, test } from "bun:test";

import {
  buildStayCommissionBreakdown,
  buildStayGrossBreakdown,
  buildStayNetPayoutBreakdown,
  buildStayTaxesBreakdown,
  getStayNetPayout,
  getStayTaxableBase,
  getStayTaxesTotal,
  type IPropertySettings,
  type IPropertyTaxRate,
  isOperandInMetric,
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

function toStayBreakdownInput(
  channel: (typeof ReservationChannel)[keyof typeof ReservationChannel],
  result: ReturnType<typeof calculateStayIncome>,
  roomTotal: number,
  cleaningFee: number,
  nights: number
) {
  return {
    channel,
    channelCommission: result.channelCommission,
    channelCommissionRate: result.channelCommissionRate,
    cleaningFee,
    grossIncome: result.grossIncome,
    netIncome: result.netIncome,
    nights,
    roomTotal,
    taxBreakdown: result.taxBreakdown,
  };
}

function sumSignedGrossLines(input: ReturnType<typeof toStayBreakdownInput>): number {
  const breakdown = buildStayGrossBreakdown(input);
  const taxableBase = getStayTaxableBase(input.roomTotal, input.cleaningFee);
  const taxesTotal = getStayTaxesTotal(input);
  const resortLine = breakdown.detailLines.find((line) => line.label === "Resort tax");
  const resortAdjustment = resortLine?.amount ?? 0;

  return Math.round((taxableBase + taxesTotal - resortAdjustment) * 100) / 100;
}

function sumSignedNetPayoutLines(input: ReturnType<typeof toStayBreakdownInput>): number {
  const breakdown = buildStayNetPayoutBreakdown(input);
  const taxableBase = getStayTaxableBase(input.roomTotal, input.cleaningFee);
  const resortLine = breakdown.detailLines.find((line) => line.label === "Resort tax");
  const resortAdjustment = resortLine?.amount ?? 0;

  return Math.round((taxableBase - input.channelCommission - resortAdjustment) * 100) / 100;
}

function getBreakdownLineLabels(
  breakdown: ReturnType<typeof buildStayCommissionBreakdown>
): string[] {
  return [...breakdown.baseLines, ...breakdown.detailLines].map((line) => line.label);
}

describe("isOperandInMetric", () => {
  test("taxes always includes cleaning fee as an operand", () => {
    expect(isOperandInMetric("cleaningFee", "taxes", ReservationChannel.EXPEDIA)).toBe(true);
    expect(isOperandInMetric("roomTotal", "taxes", ReservationChannel.BOOKING)).toBe(true);
  });

  test("commission excludes cleaning fee for Expedia only", () => {
    expect(isOperandInMetric("cleaningFee", "commission", ReservationChannel.EXPEDIA)).toBe(false);
    expect(isOperandInMetric("cleaningFee", "commission", ReservationChannel.BOOKING)).toBe(true);
  });

  test("gross and net payout use aggregated taxable base operands", () => {
    expect(isOperandInMetric("cleaningFee", "gross", ReservationChannel.BOOKING)).toBe(false);
    expect(isOperandInMetric("roomTotal", "netPayout", ReservationChannel.AIRBNB)).toBe(false);
  });
});

describe("stay calculation breakdowns", () => {
  test("Airbnb breakdown totals match calculated stay income", () => {
    const result = calc(ReservationChannel.AIRBNB);
    const stay = toStayBreakdownInput(ReservationChannel.AIRBNB, result, 1000, 0, 10);

    expect(buildStayTaxesBreakdown(stay).total).toBe(getStayTaxesTotal(stay));
    expect(buildStayCommissionBreakdown(stay).total).toBe(result.channelCommission);
    expect(buildStayGrossBreakdown(stay).total).toBe(result.grossIncome);
    expect(buildStayNetPayoutBreakdown(stay).total).toBe(getStayNetPayout(stay));
    expect(sumSignedGrossLines(stay)).toBe(result.grossIncome);
    expect(sumSignedNetPayoutLines(stay)).toBe(getStayNetPayout(stay));
  });

  test("Booking breakdown totals match calculated stay income", () => {
    const result = calc(ReservationChannel.BOOKING);
    const stay = toStayBreakdownInput(ReservationChannel.BOOKING, result, 1000, 0, 10);

    expect(buildStayTaxesBreakdown(stay).total).toBe(100);
    expect(buildStayCommissionBreakdown(stay).total).toBe(150);
    expect(buildStayGrossBreakdown(stay).total).toBe(1100);
    expect(buildStayNetPayoutBreakdown(stay).total).toBe(850);
    expect(sumSignedGrossLines(stay)).toBe(1100);
    expect(sumSignedNetPayoutLines(stay)).toBe(850);
  });

  test("Expedia breakdown reflects room-total-only commission base", () => {
    const result = calculateStayIncome({
      channel: ReservationChannel.EXPEDIA,
      cleaningFee: 100,
      nights: 5,
      roomTotal: 900,
      settings: SETTINGS,
      taxRates: TAX_RATES,
      unitRentalType: UnitRentalType.SHORT_TERM,
    });
    const stay = toStayBreakdownInput(ReservationChannel.EXPEDIA, result, 900, 100, 5);
    const commissionBreakdown = buildStayCommissionBreakdown(stay);
    const taxesBreakdown = buildStayTaxesBreakdown(stay);

    expect(commissionBreakdown.total).toBe(135);
    expect(commissionBreakdown.baseLines[0]?.note).toBe("Commission base");
    expect(getBreakdownLineLabels(commissionBreakdown)).not.toContain("Cleaning fee");
    expect(taxesBreakdown.baseLines.some((line) => line.label === "Cleaning fee")).toBe(true);
    expect(buildStayGrossBreakdown(stay).total).toBe(1100);
    expect(buildStayNetPayoutBreakdown(stay).total).toBe(865);
  });

  test("taxes breakdown still shows cleaning fee when amount is zero", () => {
    const result = calc(ReservationChannel.BOOKING);
    const stay = toStayBreakdownInput(ReservationChannel.BOOKING, result, 1000, 0, 10);
    const cleaningLine = buildStayTaxesBreakdown(stay).baseLines.find(
      (line) => line.label === "Cleaning fee"
    );

    expect(cleaningLine).toBeDefined();
    expect(cleaningLine?.amount).toBe(0);
  });
});

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

describe("calculateStayIncome — Expedia commission base", () => {
  test("Expedia commission excludes cleaning fee from base", () => {
    const result = calculateStayIncome({
      channel: ReservationChannel.EXPEDIA,
      cleaningFee: 100,
      nights: 5,
      roomTotal: 900,
      settings: SETTINGS,
      taxRates: TAX_RATES,
      unitRentalType: UnitRentalType.SHORT_TERM,
    });
    const stay = { netIncome: result.netIncome, taxBreakdown: result.taxBreakdown };

    // taxable base = 1000; taxes = 100; commission = 900 * 0.15 = 135
    expect(result.channelCommission).toBe(135);
    expect(result.grossIncome).toBe(1100);
    expect(result.netIncome).toBe(765);
    expect(getStayNetPayout(stay)).toBe(865);
  });

  test("Booking still uses room total + cleaning fee for commission", () => {
    const result = calculateStayIncome({
      channel: ReservationChannel.BOOKING,
      cleaningFee: 100,
      nights: 5,
      roomTotal: 900,
      settings: SETTINGS,
      taxRates: TAX_RATES,
      unitRentalType: UnitRentalType.SHORT_TERM,
    });

    expect(result.channelCommission).toBe(150);
  });
});
