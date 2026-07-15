import { type CreateIncomeLineDialogPrefill } from "@/components/income/create-income-line-dialog";
import { clampToMaxLocalIsoDate, getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { type IPropertyLongStay } from "@/packages/shared";

import {
  getExpectedRentForScheduleMonth,
  type TLeaseRentScheduleMonthAmount,
} from "./lease-rent-schedule-display";

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
  const monthDate = month ? `${month}-01` : maxDate;
  const scheduleAmount =
    month && options?.rentSchedule
      ? getExpectedRentForScheduleMonth(options.rentSchedule, month)
      : options?.expectedAmount;

  return {
    amount: String(scheduleAmount ?? lease.monthlyRent),
    guestName: lease.guestName,
    incomeLineTypeId,
    longStayId: lease.id,
    transactionDate: clampToMaxLocalIsoDate(monthDate, maxDate),
    unitId: lease.unitId,
  };
}
