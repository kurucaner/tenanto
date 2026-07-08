import {
  ReservationChannel,
  type IPropertyReservation,
  type TReservationChannel,
} from "./property-reservation-types";
import {
  formatRateAsPercent,
  type IPropertySettings,
  type IPropertyTaxBreakdownItem,
  RESORT_TAX_NAME,
} from "./property-settings-types";

export type TStayCalculationMetric = "commission" | "gross" | "netPayout" | "taxes";

export interface IStayCalculationLine {
  amount: number;
  displayValue?: string;
  emphasis?: "normal" | "subtotal" | "total";
  label: string;
  note?: string;
  sign?: "+" | "−" | "=";
}

export interface IStayCalculationBreakdown {
  footnote?: string;
  lines: IStayCalculationLine[];
  total: number;
  totalLabel: string;
}

type TStayBreakdownInput = Pick<
  IPropertyReservation,
  | "channel"
  | "channelCommission"
  | "channelCommissionRate"
  | "cleaningFee"
  | "grossIncome"
  | "netIncome"
  | "nights"
  | "roomTotal"
  | "taxBreakdown"
>;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type TChannelCommissionSettings = Pick<
  IPropertySettings,
  | "airbnbCommissionRate"
  | "bookingCommissionRate"
  | "directCommissionRate"
  | "expediaCommissionRate"
>;

export function getChannelCommissionRate(
  channel: TReservationChannel,
  settings: TChannelCommissionSettings
): number {
  switch (channel) {
    case ReservationChannel.AIRBNB:
      return settings.airbnbCommissionRate;
    case ReservationChannel.BOOKING:
      return settings.bookingCommissionRate;
    case ReservationChannel.EXPEDIA:
      return settings.expediaCommissionRate;
    case ReservationChannel.DIRECT:
      return settings.directCommissionRate;
  }
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
  channel: TReservationChannel,
  roomTotal: number,
  cleaningFee: number
): number {
  const base =
    channel === ReservationChannel.EXPEDIA ? roomTotal : roundMoney(roomTotal + cleaningFee);
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

function getAirbnbResortAdjustment(
  channel: TReservationChannel,
  taxBreakdown: IPropertyTaxBreakdownItem[]
): number {
  return channel === ReservationChannel.AIRBNB ? getResortTaxAmount(taxBreakdown) : 0;
}

export function buildStayTaxesBreakdown(stay: TStayBreakdownInput): IStayCalculationBreakdown {
  const taxableBase = getStayTaxableBase(stay.roomTotal, stay.cleaningFee);
  const taxesTotal = getStayTaxesTotal(stay);

  const lines: IStayCalculationLine[] = [
    { amount: stay.roomTotal, label: "Room total" },
    { amount: stay.cleaningFee, label: "Cleaning fee" },
    { amount: taxableBase, emphasis: "subtotal", label: "Taxable subtotal" },
    ...stay.taxBreakdown.map((tax) => ({
      amount: tax.amount,
      label: `${tax.name} (${formatRateAsPercent(tax.rate)}%)`,
    })),
  ];

  return {
    lines,
    total: taxesTotal,
    totalLabel: "Total taxes",
  };
}

export function buildStayCommissionBreakdown(stay: TStayBreakdownInput): IStayCalculationBreakdown {
  const commissionBase = getStayCommissionBase(stay.channel, stay.roomTotal, stay.cleaningFee);
  const rateLabel = formatRateAsPercent(stay.channelCommissionRate);
  const lines: IStayCalculationLine[] = [];

  if (stay.channel === ReservationChannel.EXPEDIA) {
    lines.push({
      amount: stay.roomTotal,
      label: "Room total",
      note: "Commission base",
    });
    if (stay.cleaningFee > 0) {
      lines.push({
        amount: stay.cleaningFee,
        label: "Cleaning fee",
        note: "Excluded from commission base",
      });
    }
  } else {
    lines.push({
      amount: commissionBase,
      label: "Commission base",
      note: "Room total + cleaning fee",
    });
  }

  lines.push({
    amount: stay.channelCommissionRate,
    displayValue: `${rateLabel}%`,
    label: "Channel commission rate",
  });
  lines.push({
    amount: stay.channelCommission,
    emphasis: "total",
    label: "Commission",
    note: `Commission base × ${rateLabel}%`,
  });

  return {
    lines,
    total: stay.channelCommission,
    totalLabel: "Commission",
  };
}

export function buildStayGrossBreakdown(stay: TStayBreakdownInput): IStayCalculationBreakdown {
  const taxableBase = getStayTaxableBase(stay.roomTotal, stay.cleaningFee);
  const taxesTotal = getStayTaxesTotal(stay);
  const resortAdjustment = getAirbnbResortAdjustment(stay.channel, stay.taxBreakdown);

  const lines: IStayCalculationLine[] = [
    { amount: taxableBase, emphasis: "subtotal", label: "Taxable base" },
    { amount: taxesTotal, label: "Total taxes", sign: "+" },
  ];

  if (resortAdjustment > 0) {
    lines.push({
      amount: resortAdjustment,
      label: "Resort tax",
      note: "Remitted by Airbnb",
      sign: "−",
    });
  }

  return {
    lines,
    total: stay.grossIncome,
    totalLabel: "Gross",
  };
}

export function buildStayNetPayoutBreakdown(stay: TStayBreakdownInput): IStayCalculationBreakdown {
  const taxableBase = getStayTaxableBase(stay.roomTotal, stay.cleaningFee);
  const resortAdjustment = getAirbnbResortAdjustment(stay.channel, stay.taxBreakdown);
  const netPayout = getStayNetPayout(stay);

  const lines: IStayCalculationLine[] = [
    { amount: taxableBase, emphasis: "subtotal", label: "Taxable base" },
    { amount: stay.channelCommission, label: "Channel commission", sign: "−" },
  ];

  if (resortAdjustment > 0) {
    lines.push({
      amount: resortAdjustment,
      label: "Resort tax",
      note: "Remitted by Airbnb",
      sign: "−",
    });
  }

  return {
    footnote: "Also equals net income + total taxes",
    lines,
    total: netPayout,
    totalLabel: "Net payout",
  };
}
