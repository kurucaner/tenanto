import { transactionDateToMonth } from "./lease-date-utils";
import { isLeaseRentMonthFullyPaid } from "./lease-rent-paid-tolerance";
import { roundMoney } from "./property-income-calculator";
import { getReportableIncomeLineAmounts } from "./property-partial-refund-utils";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";
import { resolveIncomeLineRentPeriodKey } from "./rent-period-field-utils";
import {
  isValidRentPeriodKey,
  resolveRentPeriodKeyForTransactionDate,
} from "./rent-period-key-utils";
import { centsToDollars } from "./tenant-rent-payment-utils";

export {
  isLeaseRentMonthFullyPaid,
  LEASE_RENT_PAID_TOLERANCE_DOLLARS,
} from "./lease-rent-paid-tolerance";

export interface ILeaseRentPeriodIncomeLineInput {
  amount: number;
  channelCommission: number;
  grossIncome: number;
  isDeleted: boolean;
  netIncome: number;
  refundedAmount: number | null;
  refundedAt: string | null;
  rentPeriodKey?: string | null;
  taxBreakdown: IPropertyTaxBreakdownItem[];
  transactionDate: string;
  /** @deprecated Use `rentPeriodKey`. */
  rentPeriodMonth?: string | null;
}

export interface ILeaseRentPeriodAllocationInput {
  allocatedCents: number;
  periodKey: string;
  /** @deprecated Use `periodKey`. */
  month?: string;
}

export interface ILeaseRentPeriodScheduleMonth {
  expectedRent: number;
  periodKey: string;
  /** @deprecated Use `periodKey`. */
  month?: string;
}

export interface ILeaseRentPeriodRollupMonth {
  expectedRent: number;
  isPaid: boolean;
  paidRent: number;
  periodKey: string;
  remainingRent: number;
  /** @deprecated Use `periodKey`. */
  month?: string;
}

export function getEffectiveRentPeriodKey(input: {
  rentPeriodKey?: string | null;
  schedulePeriods?: readonly string[];
  transactionDate: string;
  /** @deprecated Use `rentPeriodKey`. */
  rentPeriodMonth?: string | null;
}): string {
  const explicit = resolveIncomeLineRentPeriodKey(input)?.trim() ?? "";
  if (explicit !== "" && isValidRentPeriodKey(explicit)) {
    return explicit;
  }

  if (input.schedulePeriods && input.schedulePeriods.length > 0) {
    const resolved = resolveRentPeriodKeyForTransactionDate(
      input.transactionDate,
      input.schedulePeriods
    );
    if (resolved !== null) {
      return resolved;
    }
  }

  return transactionDateToMonth(input.transactionDate);
}

/** @deprecated Use `getEffectiveRentPeriodKey`. */
export function getEffectiveRentPeriodMonth(input: {
  rentPeriodKey?: string | null;
  schedulePeriods?: readonly string[];
  transactionDate: string;
  /** @deprecated Use `rentPeriodKey`. */
  rentPeriodMonth?: string | null;
}): string {
  return getEffectiveRentPeriodKey(input);
}

function resolveAllocationPeriodKey(allocation: ILeaseRentPeriodAllocationInput): string {
  return allocation.periodKey ?? allocation.month ?? "";
}

function resolveSchedulePeriodKey(item: ILeaseRentPeriodScheduleMonth): string {
  return item.periodKey ?? item.month ?? "";
}

function sumIncomePaidByPeriod(
  incomeLines: readonly ILeaseRentPeriodIncomeLineInput[],
  schedulePeriods: readonly string[]
): Map<string, number> {
  const byPeriod = new Map<string, number>();

  for (const line of incomeLines) {
    if (line.isDeleted) {
      continue;
    }

    const reportable = getReportableIncomeLineAmounts(line).netIncome;
    if (reportable <= 0) {
      continue;
    }

    const period = getEffectiveRentPeriodKey({
      rentPeriodKey: line.rentPeriodKey,
      rentPeriodMonth: line.rentPeriodMonth,
      schedulePeriods,
      transactionDate: line.transactionDate,
    });
    byPeriod.set(period, roundMoney((byPeriod.get(period) ?? 0) + reportable));
  }

  return byPeriod;
}

function sumAllocationPaidByPeriod(
  allocations: readonly ILeaseRentPeriodAllocationInput[]
): Map<string, number> {
  const byPeriod = new Map<string, number>();

  for (const allocation of allocations) {
    if (!Number.isInteger(allocation.allocatedCents) || allocation.allocatedCents <= 0) {
      continue;
    }

    const periodKey = resolveAllocationPeriodKey(allocation);
    const dollars = centsToDollars(allocation.allocatedCents);
    byPeriod.set(periodKey, roundMoney((byPeriod.get(periodKey) ?? 0) + dollars));
  }

  return byPeriod;
}

/**
 * Roll up lease rent paid/remaining per schedule month.
 *
 * Multiple income lines and Stripe allocations for the same effective period are
 * **additive** — each non-deleted line with reportable `netIncome > 0` and each
 * succeeded allocation contributes to `paidRent`. Totals are capped at `expectedRent`.
 * Recording another rent income row for the same month adds to the period; it does
 * not replace prior rows.
 */
export function rollupLeaseRentByPeriod(input: {
  allocations?: readonly ILeaseRentPeriodAllocationInput[];
  incomeLines: readonly ILeaseRentPeriodIncomeLineInput[];
  scheduleMonths: readonly ILeaseRentPeriodScheduleMonth[];
}): ILeaseRentPeriodRollupMonth[] {
  const schedulePeriods = input.scheduleMonths.map((item) => resolveSchedulePeriodKey(item));
  const incomeByPeriod = sumIncomePaidByPeriod(input.incomeLines, schedulePeriods);
  const allocationByPeriod = sumAllocationPaidByPeriod(input.allocations ?? []);

  return input.scheduleMonths.map(({ expectedRent, month, periodKey }) => {
    const resolvedPeriodKey = periodKey ?? month ?? "";
    const incomePaid = incomeByPeriod.get(resolvedPeriodKey) ?? 0;
    const allocationPaid = allocationByPeriod.get(resolvedPeriodKey) ?? 0;
    const rawPaid = roundMoney(incomePaid + allocationPaid);
    const paidRent = roundMoney(Math.min(expectedRent, Math.max(0, rawPaid)));
    const isPaid = isLeaseRentMonthFullyPaid(expectedRent, paidRent);
    const remainingRent = isPaid ? 0 : roundMoney(Math.max(0, expectedRent - paidRent));

    return {
      expectedRent,
      isPaid,
      month: resolvedPeriodKey,
      paidRent,
      periodKey: resolvedPeriodKey,
      remainingRent,
    };
  });
}
