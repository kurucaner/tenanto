import type { IPropertyLongStayRentMonth } from "./property-long-stay-types";
import { resolveAsOfPeriodKey } from "./rent-period-key-utils";
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
  asOfReferenceDate: string
): ITenantRentScheduleBalance {
  const schedulePeriods = schedule.map((row) => row.month);
  const asOfKey = resolveAsOfPeriodKey(asOfReferenceDate, schedulePeriods);
  const periods = computeRemainingByMonth(
    schedule.map((row) => ({
      expectedCents: dollarsToCents(row.expectedRent),
      month: row.month,
      paidCents: dollarsToCents(row.paidRent),
    }))
  );

  return {
    amountDueCents: sumAmountDueCents(periods, asOfKey),
    periodMonths: selectDuePeriodMonths(periods, asOfKey),
    periods,
  };
}
