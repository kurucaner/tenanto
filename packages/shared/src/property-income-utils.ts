import type { IPropertyReservation } from "./property-reservation-types";
import {
  ReservationChannel,
  type TReservationChannel,
} from "./property-reservation-types";
import {
  type IPropertySettings,
  type IPropertyTaxBreakdownItem,
  RESORT_TAX_NAME,
} from "./property-settings-types";

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

// Amount of the "Resort tax" line in a tax breakdown, matched by name (case-insensitive),
// or 0 if the property has no resort tax.
export function getResortTaxAmount(taxBreakdown: IPropertyTaxBreakdownItem[]): number {
  const item = taxBreakdown.find(
    (tax) => tax.name.trim().toLowerCase() === RESORT_TAX_NAME.toLowerCase()
  );
  return item ? roundMoney(item.amount) : 0;
}
