import type { IPropertyLongStayRentMonth } from "./property-long-stay-types";
import type { ITenantLeaseBalancePeriod } from "./tenant-rent-payment-types";
import {
  computeRemainingByMonth,
  dollarsToCents,
  selectDuePeriodMonths,
  sumAmountDueCents,
} from "./tenant-rent-payment-utils";

export type TTenantRentScheduleBalanceMonth = Pick<
  IPropertyLongStayRentMonth,
  "expectedRent" | "month" | "paidRent"
>;

export interface ITenantRentScheduleBalance {
  amountDueCents: number;
  periodMonths: string[];
  periods: ITenantLeaseBalancePeriod[];
}

/** Map Phase 1 rent schedule rollup rows to tenant balance due amounts. */
export function computeTenantBalanceFromRentSchedule(
  schedule: readonly TTenantRentScheduleBalanceMonth[],
  asOfMonth: string
): ITenantRentScheduleBalance {
  const periods = computeRemainingByMonth(
    schedule.map((row) => ({
      expectedCents: dollarsToCents(row.expectedRent),
      month: row.month,
      paidCents: dollarsToCents(row.paidRent),
    }))
  );

  return {
    amountDueCents: sumAmountDueCents(periods, asOfMonth),
    periodMonths: selectDuePeriodMonths(periods, asOfMonth),
    periods,
  };
}
