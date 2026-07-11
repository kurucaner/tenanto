import { describe, expect, test } from "bun:test";

import {
  buildStayCommissionBreakdown,
  buildStayGrossBreakdown,
  buildStayNetPayoutBreakdown,
  buildStayTaxesBreakdown,
  DEFAULT_PROPERTY_CHANNEL_COMMISSIONS,
  getStayNetPayout,
  getStayTaxableBase,
  getStayTaxesTotal,
  type IPropertyChannelCommission,
  type IPropertyTaxRate,
  isOperandInMetric,
  UnitRentalType,
} from "@/packages/shared";
import { calculateStayIncome } from "@/services/property-income-calculator";

const TAX_RATES: IPropertyTaxRate[] = [
  { id: "tax-sales", name: "Sales tax", propertyId: "prop-1", rate: 0.06, sortOrder: 1 },
  { id: "tax-resort", name: "Resort tax", propertyId: "prop-1", rate: 0.04, sortOrder: 2 },
];

function makeChannel(
  defaults: (typeof DEFAULT_PROPERTY_CHANNEL_COMMISSIONS)[number],
  id: string
): IPropertyChannelCommission {
  return {
    excludeCleaningFromCommissionBase: defaults.excludeCleaningFromCommissionBase ?? false,
    excludeResortTaxFromPayout: defaults.excludeResortTaxFromPayout ?? false,
    id,
    name: defaults.name,
    propertyId: "prop-1",
    rate: defaults.rate,
    sortOrder: 1,
  };
}

const AIRBNB = makeChannel(DEFAULT_PROPERTY_CHANNEL_COMMISSIONS[0]!, "channel-airbnb");
const BOOKING = makeChannel(DEFAULT_PROPERTY_CHANNEL_COMMISSIONS[1]!, "channel-booking");
const EXPEDIA = makeChannel(DEFAULT_PROPERTY_CHANNEL_COMMISSIONS[2]!, "channel-expedia");

// base = 100 * 10 + 0 = 1000; salesTax = 60; resortTax = 40; totalTaxes = 100.
function calc(channelCommission: IPropertyChannelCommission, taxRates = TAX_RATES) {
  return calculateStayIncome({
    channelCommission,
    cleaningFee: 0,
    nights: 10,
    roomTotal: 1000,
    taxRates,
    unitRentalType: UnitRentalType.SHORT_TERM,
  });
}

function toStayBreakdownInput(
  channelCommission: IPropertyChannelCommission,
  result: ReturnType<typeof calculateStayIncome>,
  roomTotal: number,
  cleaningFee: number,
  nights: number
) {
  return {
    channelCommission: result.channelCommission,
    channelCommissionRate: result.channelCommissionRate,
    cleaningFee,
    excludeCleaningFromCommissionBase: channelCommission.excludeCleaningFromCommissionBase,
    excludeResortTaxFromPayout: channelCommission.excludeResortTaxFromPayout,
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
    expect(
      isOperandInMetric("cleaningFee", "taxes", {
        excludeCleaningFromCommissionBase: true,
        excludeResortTaxFromPayout: false,
      })
    ).toBe(true);
    expect(
      isOperandInMetric("roomTotal", "taxes", {
        excludeCleaningFromCommissionBase: false,
        excludeResortTaxFromPayout: false,
      })
    ).toBe(true);
  });

  test("commission excludes cleaning fee when channel flag is set", () => {
    expect(
      isOperandInMetric("cleaningFee", "commission", {
        excludeCleaningFromCommissionBase: true,
        excludeResortTaxFromPayout: false,
      })
    ).toBe(false);
    expect(
      isOperandInMetric("cleaningFee", "commission", {
        excludeCleaningFromCommissionBase: false,
        excludeResortTaxFromPayout: false,
      })
    ).toBe(true);
  });

  test("gross and net payout use aggregated taxable base operands", () => {
    expect(
      isOperandInMetric("cleaningFee", "gross", {
        excludeCleaningFromCommissionBase: false,
        excludeResortTaxFromPayout: false,
      })
    ).toBe(false);
    expect(
      isOperandInMetric("roomTotal", "netPayout", {
        excludeCleaningFromCommissionBase: false,
        excludeResortTaxFromPayout: true,
      })
    ).toBe(false);
  });
});

describe("stay calculation breakdowns", () => {
  test("Airbnb breakdown totals match calculated stay income", () => {
    const result = calc(AIRBNB);
    const stay = toStayBreakdownInput(AIRBNB, result, 1000, 0, 10);

    expect(buildStayTaxesBreakdown(stay).total).toBe(getStayTaxesTotal(stay));
    expect(buildStayCommissionBreakdown(stay).total).toBe(result.channelCommission);
    expect(buildStayGrossBreakdown(stay).total).toBe(result.grossIncome);
    expect(buildStayNetPayoutBreakdown(stay).total).toBe(getStayNetPayout(stay));
    expect(sumSignedGrossLines(stay)).toBe(result.grossIncome);
    expect(sumSignedNetPayoutLines(stay)).toBe(getStayNetPayout(stay));
  });

  test("Booking breakdown totals match calculated stay income", () => {
    const result = calc(BOOKING);
    const stay = toStayBreakdownInput(BOOKING, result, 1000, 0, 10);

    expect(buildStayTaxesBreakdown(stay).total).toBe(100);
    expect(buildStayCommissionBreakdown(stay).total).toBe(150);
    expect(buildStayGrossBreakdown(stay).total).toBe(1100);
    expect(buildStayNetPayoutBreakdown(stay).total).toBe(850);
    expect(sumSignedGrossLines(stay)).toBe(1100);
    expect(sumSignedNetPayoutLines(stay)).toBe(850);
  });

  test("Expedia breakdown reflects room-total-only commission base", () => {
    const result = calculateStayIncome({
      channelCommission: EXPEDIA,
      cleaningFee: 100,
      nights: 5,
      roomTotal: 900,
      taxRates: TAX_RATES,
      unitRentalType: UnitRentalType.SHORT_TERM,
    });
    const stay = toStayBreakdownInput(EXPEDIA, result, 900, 100, 5);
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
    const result = calc(BOOKING);
    const stay = toStayBreakdownInput(BOOKING, result, 1000, 0, 10);
    const cleaningLine = buildStayTaxesBreakdown(stay).baseLines.find(
      (line) => line.label === "Cleaning fee"
    );

    expect(cleaningLine).toBeDefined();
    expect(cleaningLine?.amount).toBe(0);
  });
});

describe("calculateStayIncome — Airbnb resort tax exclusion", () => {
  test("Airbnb excludes resort tax from gross and payout", () => {
    const result = calc(AIRBNB);
    const stay = { netIncome: result.netIncome, taxBreakdown: result.taxBreakdown };

    expect(result.channelCommission).toBe(155);
    expect(result.grossIncome).toBe(1060);
    expect(result.netIncome).toBe(705);
    expect(getStayNetPayout(stay)).toBe(805);
  });

  test("non-Airbnb channels are unchanged (resort tax stays in gross)", () => {
    const result = calc(BOOKING);
    expect(result.channelCommission).toBe(150);
    expect(result.grossIncome).toBe(1100);
    expect(result.netIncome).toBe(750);
    expect(
      getStayNetPayout({ netIncome: result.netIncome, taxBreakdown: result.taxBreakdown })
    ).toBe(850);
  });

  test("Airbnb with no resort tax is unchanged", () => {
    const salesOnly = [TAX_RATES[0]] as IPropertyTaxRate[];
    const result = calc(AIRBNB, salesOnly);
    expect(result.grossIncome).toBe(1060);
    expect(result.netIncome).toBe(785);
  });
});

describe("calculateStayIncome — Expedia commission base", () => {
  test("Expedia commission excludes cleaning fee from base", () => {
    const result = calculateStayIncome({
      channelCommission: EXPEDIA,
      cleaningFee: 100,
      nights: 5,
      roomTotal: 900,
      taxRates: TAX_RATES,
      unitRentalType: UnitRentalType.SHORT_TERM,
    });
    const stay = { netIncome: result.netIncome, taxBreakdown: result.taxBreakdown };

    expect(result.channelCommission).toBe(135);
    expect(result.grossIncome).toBe(1100);
    expect(result.netIncome).toBe(765);
    expect(getStayNetPayout(stay)).toBe(865);
  });

  test("Booking still uses room total + cleaning fee for commission", () => {
    const result = calculateStayIncome({
      channelCommission: BOOKING,
      cleaningFee: 100,
      nights: 5,
      roomTotal: 900,
      taxRates: TAX_RATES,
      unitRentalType: UnitRentalType.SHORT_TERM,
    });

    expect(result.channelCommission).toBe(150);
  });
});
