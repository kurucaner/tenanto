import type { IPropertyReservation } from "./property-reservation-types";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumTaxBreakdown(taxBreakdown: IPropertyTaxBreakdownItem[]): number {
  return taxBreakdown.reduce((sum, item) => sum + item.amount, 0);
}

export function getStayTaxesAndFeesTotal(
  stay: Pick<IPropertyReservation, "taxBreakdown" | "channelCommission">
): number {
  return roundMoney(sumTaxBreakdown(stay.taxBreakdown) + stay.channelCommission);
}
