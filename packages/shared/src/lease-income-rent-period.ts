import { transactionDateToMonth } from "./lease-date-utils";
import { isValidPeriodMonth } from "./tenant-rent-payment-utils";

export function resolveLeaseIncomeRentPeriodMonth(input: {
  rentPeriodMonth?: string | null;
  scheduleMonths: readonly string[];
  transactionDate: string;
}): { ok: true; value: string } | { ok: false; error: string } {
  const explicit = input.rentPeriodMonth?.trim() ?? "";

  if (explicit !== "") {
    if (!isValidPeriodMonth(explicit)) {
      return { error: "rentPeriodMonth must be YYYY-MM", ok: false };
    }
    if (!input.scheduleMonths.includes(explicit)) {
      return {
        error: "rentPeriodMonth must be a month in the lease rent schedule",
        ok: false,
      };
    }
    return { ok: true, value: explicit };
  }

  const defaulted = transactionDateToMonth(input.transactionDate);
  if (!isValidPeriodMonth(defaulted)) {
    return { error: "transactionDate must be a YYYY-MM-DD date", ok: false };
  }
  if (!input.scheduleMonths.includes(defaulted)) {
    return {
      error: "transactionDate falls outside the lease rent schedule; set rentPeriodMonth",
      ok: false,
    };
  }
  return { ok: true, value: defaulted };
}
