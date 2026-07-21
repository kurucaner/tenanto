import {
  comparePeriodKeys,
  isValidRentPeriodKey,
  resolveRentPeriodKeyForTransactionDate,
} from "./rent-period-key-utils";
import { resolveIncomeLineRentPeriodKey } from "./rent-period-field-utils";

export const LEASE_UPCOMING_RENT_PERIOD_ERROR = "Cannot record rent for an upcoming lease month";

export function resolveLeaseIncomeRentPeriodKey(input: {
  asOfMonth?: string;
  rentPeriodKey?: string | null;
  /** @deprecated Use `rentPeriodKey`. */
  rentPeriodMonth?: string | null;
  scheduleMonths: readonly string[];
  transactionDate: string;
}): { ok: true; value: string } | { ok: false; error: string } {
  const explicit = resolveIncomeLineRentPeriodKey(input)?.trim() ?? "";

  if (explicit !== "") {
    if (!isValidRentPeriodKey(explicit)) {
      return { error: "rentPeriodKey must be YYYY-MM or YYYY-MM-DD", ok: false };
    }
    if (!input.scheduleMonths.includes(explicit)) {
      return {
        error: "rentPeriodKey must be a period in the lease rent schedule",
        ok: false,
      };
    }
    const upcoming = rejectUpcomingLeaseRentPeriod(explicit, input.asOfMonth);
    if (upcoming) {
      return upcoming;
    }
    return { ok: true, value: explicit };
  }

  const defaulted = resolveRentPeriodKeyForTransactionDate(
    input.transactionDate,
    input.scheduleMonths
  );
  if (defaulted === null) {
    return {
      error: "transactionDate falls outside the lease rent schedule; set rentPeriodKey",
      ok: false,
    };
  }
  if (!isValidRentPeriodKey(defaulted)) {
    return { error: "transactionDate must be a YYYY-MM-DD date", ok: false };
  }
  if (!input.scheduleMonths.includes(defaulted)) {
    return {
      error: "transactionDate falls outside the lease rent schedule; set rentPeriodKey",
      ok: false,
    };
  }
  const upcoming = rejectUpcomingLeaseRentPeriod(defaulted, input.asOfMonth);
  if (upcoming) {
    return upcoming;
  }
  return { ok: true, value: defaulted };
}

/** @deprecated Use `resolveLeaseIncomeRentPeriodKey`. */
export function resolveLeaseIncomeRentPeriodMonth(input: {
  asOfMonth?: string;
  rentPeriodMonth?: string | null;
  scheduleMonths: readonly string[];
  transactionDate: string;
}): { ok: true; value: string } | { ok: false; error: string } {
  return resolveLeaseIncomeRentPeriodKey(input);
}

/** Preferred name — resolves the rent period key for a lease income line. */
export const resolveDefaultRentPeriodForIncomeLine = resolveLeaseIncomeRentPeriodKey;

function rejectUpcomingLeaseRentPeriod(
  resolvedPeriod: string,
  asOfPeriod: string | undefined
): { error: string; ok: false } | null {
  if (asOfPeriod === undefined || !isValidRentPeriodKey(asOfPeriod)) {
    return null;
  }

  if (comparePeriodKeys(resolvedPeriod, asOfPeriod) > 0) {
    return { error: LEASE_UPCOMING_RENT_PERIOD_ERROR, ok: false };
  }

  return null;
}
