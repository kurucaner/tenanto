import type { IPropertyReservation } from "./property-reservation-types";
import {
  ReservationChannel,
  type TReservationChannel,
} from "./property-reservation-types";
import type { IPropertySettings, IPropertyTaxBreakdownItem } from "./property-settings-types";

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

export function getStayTaxesAndFeesTotal(
  stay: Pick<IPropertyReservation, "taxBreakdown" | "channelCommission">
): number {
  return roundMoney(sumTaxBreakdown(stay.taxBreakdown) + stay.channelCommission);
}
