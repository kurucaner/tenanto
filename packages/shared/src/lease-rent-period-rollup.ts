import { transactionDateToMonth } from "./lease-date-utils";
import { isLeaseRentMonthFullyPaid } from "./lease-rent-paid-tolerance";
import { roundMoney } from "./property-income-calculator";
import { getReportableIncomeLineAmounts } from "./property-partial-refund-utils";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";
import { centsToDollars, isValidPeriodMonth } from "./tenant-rent-payment-utils";

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
  rentPeriodMonth?: string | null;
  taxBreakdown: IPropertyTaxBreakdownItem[];
  transactionDate: string;
}

export interface ILeaseRentPeriodAllocationInput {
  allocatedCents: number;
  month: string;
}

export interface ILeaseRentPeriodScheduleMonth {
  expectedRent: number;
  month: string;
}

export interface ILeaseRentPeriodRollupMonth {
  expectedRent: number;
  isPaid: boolean;
  month: string;
  paidRent: number;
  remainingRent: number;
}

export function getEffectiveRentPeriodMonth(input: {
  rentPeriodMonth?: string | null;
  transactionDate: string;
}): string {
  const explicit = input.rentPeriodMonth?.trim() ?? "";
  if (explicit !== "" && isValidPeriodMonth(explicit)) {
    return explicit;
  }
  return transactionDateToMonth(input.transactionDate);
}

function sumIncomePaidByPeriod(
  incomeLines: readonly ILeaseRentPeriodIncomeLineInput[]
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

    const period = getEffectiveRentPeriodMonth(line);
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

    const dollars = centsToDollars(allocation.allocatedCents);
    byPeriod.set(allocation.month, roundMoney((byPeriod.get(allocation.month) ?? 0) + dollars));
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
  const incomeByPeriod = sumIncomePaidByPeriod(input.incomeLines);
  const allocationByPeriod = sumAllocationPaidByPeriod(input.allocations ?? []);

  return input.scheduleMonths.map(({ expectedRent, month }) => {
    const incomePaid = incomeByPeriod.get(month) ?? 0;
    const allocationPaid = allocationByPeriod.get(month) ?? 0;
    const rawPaid = roundMoney(incomePaid + allocationPaid);
    const paidRent = roundMoney(Math.min(expectedRent, Math.max(0, rawPaid)));
    const isPaid = isLeaseRentMonthFullyPaid(expectedRent, paidRent);
    const remainingRent = isPaid ? 0 : roundMoney(Math.max(0, expectedRent - paidRent));

    return {
      expectedRent,
      isPaid,
      month,
      paidRent,
      remainingRent,
    };
  });
}
