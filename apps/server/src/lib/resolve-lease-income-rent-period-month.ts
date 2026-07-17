import { propertyLongStaysDb } from "@/db/property-long-stays";
import {
  enumerateLeaseMonths,
  getLeaseScheduleEffectiveEndDate,
  resolveLeaseIncomeRentPeriodMonth,
  transactionDateToMonth,
} from "@/packages/shared";

import { getTodayUtcIsoDate } from "./validate-create-expense-body";

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
  const scheduleMonths = enumerateLeaseMonths(longStay.leaseStartDate, effectiveEndDate);

  return resolveLeaseIncomeRentPeriodMonth({
    asOfMonth: transactionDateToMonth(referenceDate),
    rentPeriodMonth: input.rentPeriodMonth,
    scheduleMonths,
    transactionDate: input.transactionDate,
  });
}
