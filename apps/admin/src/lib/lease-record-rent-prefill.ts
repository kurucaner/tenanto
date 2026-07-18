import { type CreateIncomeLineDialogPrefill } from "@/components/income/create-income-line-dialog";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { type IPropertyLongStay } from "@/packages/shared";

import {
  getExpectedRentForScheduleMonth,
  getRemainingRentForScheduleMonth,
  type TLeaseRentScheduleMonthAmount,
} from "./lease-rent-schedule-display";

/**
 * Prefill for Record Rent on a lease schedule month.
 * Each submission creates a new income line; partial payments for the same
 * `rentPeriodMonth` are additive and roll up to `paidRent` on the schedule.
 */
export function buildLeaseRecordRentPrefill(
  lease: Pick<IPropertyLongStay, "guestName" | "id" | "monthlyRent" | "unitId">,
  incomeLineTypeId: string,
  options?: {
    expectedAmount?: number;
    month?: string;
    rentSchedule?: readonly TLeaseRentScheduleMonthAmount[];
  }
): CreateIncomeLineDialogPrefill {
  const maxDate = getTodayLocalIsoDate();
  const month = options?.month;
  const scheduleAmount =
    month && options?.rentSchedule
      ? (getRemainingRentForScheduleMonth(options.rentSchedule, month) ??
        getExpectedRentForScheduleMonth(options.rentSchedule, month))
      : options?.expectedAmount;

  return {
    amount: String(scheduleAmount ?? lease.monthlyRent),
    guestName: lease.guestName,
    incomeLineTypeId,
    longStayId: lease.id,
    rentPeriodMonth: month,
    transactionDate: maxDate,
    unitId: lease.unitId,
  };
}
