import { propertyLongStaysDb } from "@/db/property-long-stays";
import {
  enumerateLeaseSchedulePeriods,
  getLeaseScheduleEffectiveEndDate,
  resolveAsOfPeriodKey,
  resolveLeaseIncomeRentPeriodKey,
} from "@/packages/shared";

import { getTodayUtcIsoDate } from "./date-utils";

export async function resolveLeaseIncomeRentPeriodKeyForLongStay(input: {
  longStayId: string;
  referenceDate?: string;
  rentPeriodKey?: string | null;
  transactionDate: string;
}): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const longStay = await propertyLongStaysDb.findById(input.longStayId);
  if (!longStay) {
    return { error: "Long stay not found", ok: false };
  }

  const referenceDate = input.referenceDate ?? getTodayUtcIsoDate();
  const effectiveEndDate = getLeaseScheduleEffectiveEndDate(longStay, referenceDate);
  const schedulePeriods = enumerateLeaseSchedulePeriods(longStay, effectiveEndDate);

  return resolveLeaseIncomeRentPeriodKey({
    asOfMonth: resolveAsOfPeriodKey(referenceDate, schedulePeriods),
    rentPeriodKey: input.rentPeriodKey,
    scheduleMonths: schedulePeriods,
    transactionDate: input.transactionDate,
  });
}

/** @deprecated Use `resolveLeaseIncomeRentPeriodKeyForLongStay`. */
export async function resolveLeaseIncomeRentPeriodMonthForLongStay(input: {
  longStayId: string;
  referenceDate?: string;
  rentPeriodKey?: string | null;
  /** @deprecated Use `rentPeriodKey`. */
  rentPeriodMonth?: string | null;
  transactionDate: string;
}): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  return resolveLeaseIncomeRentPeriodKeyForLongStay({
    longStayId: input.longStayId,
    referenceDate: input.referenceDate,
    rentPeriodKey: input.rentPeriodKey ?? input.rentPeriodMonth,
    transactionDate: input.transactionDate,
  });
}
