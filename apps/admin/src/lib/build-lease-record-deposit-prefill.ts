import { type CreateIncomeLineDialogPrefill } from "@/components/income/create-income-line-dialog";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { type IPropertyLongStay } from "@/packages/shared";

/**
 * Prefill for Record Deposit on a lease.
 * Income type is resolved server-side as the system Security deposit type.
 * Never sets `rentPeriodKey` — deposits are not rent-schedule lines.
 */
export function buildLeaseRecordDepositPrefill(
  lease: Pick<IPropertyLongStay, "guestName" | "id" | "securityDepositAmount" | "unitId">
): CreateIncomeLineDialogPrefill {
  const amount = lease.securityDepositAmount;
  const amountPrefill =
    typeof amount === "number" && Number.isFinite(amount) ? amount.toString() : "";

  return {
    amount: amountPrefill,
    guestName: lease.guestName,
    isSecurityDeposit: true,
    longStayId: lease.id,
    transactionDate: getTodayLocalIsoDate(),
    unitId: lease.unitId,
  };
}

/** v1: show Record deposit when a positive contractual amount is set. */
export function canRecordLeaseSecurityDeposit(
  lease: Pick<IPropertyLongStay, "securityDepositAmount">
): boolean {
  const amount = lease.securityDepositAmount;
  return amount != null && Number.isFinite(amount) && amount > 0;
}
