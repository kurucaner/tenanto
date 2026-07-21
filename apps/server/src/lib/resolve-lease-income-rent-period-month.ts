import { propertyLongStaysDb } from "@/db/property-long-stays";
import {
  enumerateLeaseMonths,
  enumerateLeaseWeeks,
  getLeaseScheduleEffectiveEndDate,
  isWeeklyRentBillingCadence,
  resolveAsOfPeriodKey,
  resolveLeaseIncomeRentPeriodMonth,
} from "@/packages/shared";

import { getTodayUtcIsoDate } from "./date-utils";

export async function resolveLeaseIncomeRentPeriodMonthForLongStay(input: {
  longStayId: string;
  referenceDate?: string;
  rentPeriodMonth?: string | null;
  transactionDate: string;
}): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const longStay = await propertyLongStaysDb.findById(input.longStayId);
  if (!longStay) {
    return { error: "Long stay not found", ok: false };
  }

  const referenceDate = input.referenceDate ?? getTodayUtcIsoDate();
  const effectiveEndDate = getLeaseScheduleEffectiveEndDate(longStay, referenceDate);
  const schedulePeriods = isWeeklyRentBillingCadence(longStay.rentBillingCadence)
    ? enumerateLeaseWeeks(longStay.leaseStartDate, effectiveEndDate)
    : enumerateLeaseMonths(longStay.leaseStartDate, effectiveEndDate);

  return resolveLeaseIncomeRentPeriodMonth({
    asOfMonth: resolveAsOfPeriodKey(referenceDate, schedulePeriods),
    rentPeriodMonth: input.rentPeriodMonth,
    scheduleMonths: schedulePeriods,
    transactionDate: input.transactionDate,
  });
}
