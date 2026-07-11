import { type IPropertyChannelCommission } from "./property-channel-commission-config";
import { type IPropertyReservation } from "./property-reservation-types";
import {
  formatRateAsPercent,
  type IPropertyTaxBreakdownItem,
  RESORT_TAX_NAME,
} from "./property-settings-types";

export type TStayCalculationMetric = "commission" | "gross" | "netPayout" | "taxes";

export type TBreakdownOperand = "cleaningFee" | "roomTotal";

export interface IStayCalculationLine {
  amount: number;
  displayValue?: string;
  emphasis?: "normal" | "subtotal" | "total";
  label: string;
  note?: string;
  sign?: "+" | "−" | "=";
}

export interface IStayCalculationBreakdown {
  baseLines: IStayCalculationLine[];
  detailLines: IStayCalculationLine[];
  footnote?: string;
  total: number;
  totalLabel: string;
}

export type TStayChannelBehavior = Pick<
  IPropertyChannelCommission,
  "excludeCleaningFromCommissionBase" | "excludeResortTaxFromPayout"
>;

// Whether an operand appears as its own line in a metric's Details breakdown.
// Keep in sync with getStayCommissionBase and docs/CALCULATION_RULES.md.
export function isOperandInMetric(
  operand: TBreakdownOperand,
  metric: TStayCalculationMetric,
  channel: TStayChannelBehavior
): boolean {
  switch (metric) {
    case "taxes":
      return true;
    case "commission":
      if (operand === "cleaningFee") {
        return !channel.excludeCleaningFromCommissionBase;
      }
      return true;
    case "gross":
    case "netPayout":
      return false;
  }
}

type TStayBreakdownInput = Pick<
  IPropertyReservation,
  | "channelCommission"
  | "channelCommissionRate"
  | "cleaningFee"
  | "excludeCleaningFromCommissionBase"
  | "excludeResortTaxFromPayout"
  | "grossIncome"
  | "netIncome"
  | "nights"
  | "roomTotal"
  | "taxBreakdown"
>;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getChannelCommissionRateFromRow(
  channel: Pick<IPropertyChannelCommission, "rate">
): number {
  return channel.rate;
}

export function sumTaxBreakdown(taxBreakdown: IPropertyTaxBreakdownItem[]): number {
  return taxBreakdown.reduce((sum, item) => sum + item.amount, 0);
}

// Net Payout = taxable base − channel commission (revenue after the channel's cut, before
// taxes). Equivalent to netIncome + total taxes, since netIncome already removes taxes too.
export function getStayNetPayout(
  stay: Pick<IPropertyReservation, "netIncome" | "taxBreakdown">
): number {
  return roundMoney(stay.netIncome + sumTaxBreakdown(stay.taxBreakdown));
}

// Total applicable taxes only (excludes channel commission).
export function getStayTaxesTotal(stay: Pick<IPropertyReservation, "taxBreakdown">): number {
  return roundMoney(sumTaxBreakdown(stay.taxBreakdown));
}

export function getStayAverageDailyRate(
  stay: Pick<IPropertyReservation, "nights" | "roomTotal">
): number {
  if (stay.nights < 1) return 0;
  return roundMoney(stay.roomTotal / stay.nights);
}

export function getStayCommissionBase(
  channel: TStayChannelBehavior,
  roomTotal: number,
  cleaningFee: number
): number {
  const base = channel.excludeCleaningFromCommissionBase
    ? roomTotal
    : roundMoney(roomTotal + cleaningFee);
  return roundMoney(base);
}

// Amount of the "Resort tax" line in a tax breakdown, matched by name (case-insensitive),
// or 0 if the property has no resort tax.
export function getResortTaxAmount(taxBreakdown: IPropertyTaxBreakdownItem[]): number {
  const item = taxBreakdown.find(
    (tax) => tax.name.trim().toLowerCase() === RESORT_TAX_NAME.toLowerCase()
  );
  return item ? roundMoney(item.amount) : 0;
}

export function getStayTaxableBase(roomTotal: number, cleaningFee: number): number {
  return roundMoney(roomTotal + cleaningFee);
}

function getResortTaxAdjustment(
  channel: TStayChannelBehavior,
  taxBreakdown: IPropertyTaxBreakdownItem[]
): number {
  return channel.excludeResortTaxFromPayout ? getResortTaxAmount(taxBreakdown) : 0;
}

export function buildStayTaxesBreakdown(stay: TStayBreakdownInput): IStayCalculationBreakdown {
  const taxableBase = getStayTaxableBase(stay.roomTotal, stay.cleaningFee);
  const taxesTotal = getStayTaxesTotal(stay);

  return {
    baseLines: [
      { amount: stay.roomTotal, label: "Room total" },
      { amount: stay.cleaningFee, label: "Cleaning fee" },
      { amount: taxableBase, emphasis: "subtotal", label: "Taxable subtotal" },
    ],
    detailLines: stay.taxBreakdown.map((tax) => ({
      amount: tax.amount,
      label: `${tax.name} (${formatRateAsPercent(tax.rate)}%)`,
    })),
    total: taxesTotal,
    totalLabel: "Total taxes",
  };
}

export function buildStayCommissionBreakdown(stay: TStayBreakdownInput): IStayCalculationBreakdown {
  const commissionBase = getStayCommissionBase(stay, stay.roomTotal, stay.cleaningFee);
  const rateLabel = formatRateAsPercent(stay.channelCommissionRate);

  const baseLines: IStayCalculationLine[] = stay.excludeCleaningFromCommissionBase
    ? [
        {
          amount: stay.roomTotal,
          label: "Commission base",
          note: "(Room total)",
        },
      ]
    : [
        {
          amount: commissionBase,
          label: "Commission base",
          note: "(Room total + cleaning fee)",
        },
      ];

  return {
    baseLines,
    detailLines: [
      {
        amount: stay.channelCommissionRate,
        displayValue: `${rateLabel}%`,
        label: "Channel commission rate",
      },
      {
        amount: stay.channelCommission,
        emphasis: "total",
        label: "Commission",
        note: `Commission base × ${rateLabel}%`,
      },
    ],
    total: stay.channelCommission,
    totalLabel: "Commission",
  };
}

export function buildStayGrossBreakdown(stay: TStayBreakdownInput): IStayCalculationBreakdown {
  const taxableBase = getStayTaxableBase(stay.roomTotal, stay.cleaningFee);
  const taxesTotal = getStayTaxesTotal(stay);
  const resortAdjustment = getResortTaxAdjustment(stay, stay.taxBreakdown);

  const detailLines: IStayCalculationLine[] = [
    { amount: taxesTotal, label: "Total taxes", sign: "+" },
  ];

  if (resortAdjustment > 0) {
    detailLines.push({
      amount: resortAdjustment,
      label: "Resort tax",
      note: "Remitted by channel",
      sign: "−",
    });
  }

  return {
    baseLines: [{ amount: taxableBase, emphasis: "subtotal", label: "Taxable subtotal" }],
    detailLines,
    total: stay.grossIncome,
    totalLabel: "Gross",
  };
}

export function buildStayNetPayoutBreakdown(stay: TStayBreakdownInput): IStayCalculationBreakdown {
  const taxableBase = getStayTaxableBase(stay.roomTotal, stay.cleaningFee);
  const resortAdjustment = getResortTaxAdjustment(stay, stay.taxBreakdown);
  const netPayout = getStayNetPayout(stay);

  const detailLines: IStayCalculationLine[] = [
    { amount: stay.channelCommission, label: "Channel commission", sign: "−" },
  ];

  if (resortAdjustment > 0) {
    detailLines.push({
      amount: resortAdjustment,
      label: "Resort tax",
      note: "Remitted by channel",
      sign: "−",
    });
  }

  return {
    baseLines: [{ amount: taxableBase, emphasis: "subtotal", label: "Taxable subtotal" }],
    detailLines,
    footnote: "Also equals net income + total taxes",
    total: netPayout,
    totalLabel: "Net payout",
  };
}
