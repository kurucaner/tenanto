import { type CreateIncomeLineDialogPrefill } from "@/components/income/create-income-line-dialog";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { getLeaseRentAmount, type IPropertyLongStay } from "@/packages/shared";

import {
  getExpectedRentForSchedulePeriod,
  getRemainingRentForSchedulePeriod,
  type TLeaseRentSchedulePeriodAmount,
} from "./lease-rent-schedule-display";

/**
 * Prefill for Record Rent on a lease schedule period.
 * Each submission creates a new income line; partial payments for the same
 * `rentPeriodKey` are additive and roll up to `paidRent` on the schedule.
 * Income type is resolved server-side for lease rent lines.
 */
export function buildLeaseRecordRentPrefill(
  lease: Pick<IPropertyLongStay, "guestName" | "id" | "rentAmount" | "unitId">,
  options?: {
    expectedAmount?: number;
    periodKey?: string;
    rentSchedule?: readonly TLeaseRentSchedulePeriodAmount[];
  }
): CreateIncomeLineDialogPrefill {
  const maxDate = getTodayLocalIsoDate();
  const periodKey = options?.periodKey;
  const scheduleAmount =
    periodKey && options?.rentSchedule
      ? (getRemainingRentForSchedulePeriod(options.rentSchedule, periodKey) ??
        getExpectedRentForSchedulePeriod(options.rentSchedule, periodKey))
      : options?.expectedAmount;

  return {
    amount: String(scheduleAmount ?? getLeaseRentAmount(lease)),
    guestName: lease.guestName,
    longStayId: lease.id,
    rentPeriodKey: periodKey,
    transactionDate: maxDate,
    unitId: lease.unitId,
  };
}
