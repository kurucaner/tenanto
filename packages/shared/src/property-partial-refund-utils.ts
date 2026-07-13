import { roundMoney } from "./property-income-calculator";
import type { IPropertyIncomeLine } from "./property-income-line-types";
import type {
  IRefundLedgerEntryBody,
  IReportableStayAmounts,
  TReportableIncomeLineAmounts,
} from "./property-partial-refund-types";
import type { IPropertyReservation } from "./property-reservation-types";

export type { IRefundLedgerEntryBody, IReportableStayAmounts, TReportableIncomeLineAmounts };

function scaleMoney(value: number, factor: number): number {
  return roundMoney(value * factor);
}

/**
 * Remaining share of the original sale counted toward reports.
 * Returns 1 when not refunded, 0 when fully refunded.
 */
export function getPartialRefundReportFactor(
  refundedAt: string | null,
  refundedAmount: number | null,
  cap: number
): number {
  if (refundedAt === null) {
    return 1;
  }

  if (cap <= 0) {
    return 0;
  }

  const effectiveRefundedAmount = refundedAmount ?? cap;
  if (effectiveRefundedAmount >= cap) {
    return 0;
  }

  return (cap - effectiveRefundedAmount) / cap;
}

export function getIncomeLineRefundableCap(line: Pick<IPropertyIncomeLine, "amount">): number {
  return line.amount;
}

export function getStayRefundableCap(stay: Pick<IPropertyReservation, "grossIncome">): number {
  return stay.grossIncome;
}

export function isFullyRefunded(
  refundedAt: string | null,
  refundedAmount: number | null,
  cap: number
): boolean {
  if (refundedAt === null) {
    return false;
  }

  if (cap <= 0) {
    return true;
  }

  const effectiveRefundedAmount = refundedAmount ?? cap;
  return effectiveRefundedAmount >= cap;
}

export function getReportableStayAmounts(
  stay: Pick<
    IPropertyReservation,
    | "channelCommission"
    | "channelCommissionRate"
    | "cleaningFee"
    | "grossIncome"
    | "netIncome"
    | "refundedAmount"
    | "refundedAt"
    | "roomTotal"
    | "taxBreakdown"
  >
): IReportableStayAmounts {
  const cap = getStayRefundableCap(stay);
  const factor = getPartialRefundReportFactor(stay.refundedAt, stay.refundedAmount, cap);

  return {
    channelCommission: scaleMoney(stay.channelCommission, factor),
    channelCommissionRate: stay.channelCommissionRate,
    cleaningFee: scaleMoney(stay.cleaningFee, factor),
    grossIncome: scaleMoney(stay.grossIncome, factor),
    netIncome: scaleMoney(stay.netIncome, factor),
    roomTotal: scaleMoney(stay.roomTotal, factor),
    taxBreakdown: stay.taxBreakdown.map((item) => ({
      ...item,
      amount: scaleMoney(item.amount, factor),
    })),
  };
}

export function getReportableIncomeLineAmounts(
  line: Pick<
    IPropertyIncomeLine,
    | "amount"
    | "channelCommission"
    | "grossIncome"
    | "netIncome"
    | "refundedAmount"
    | "refundedAt"
    | "taxBreakdown"
  >
): TReportableIncomeLineAmounts {
  const cap = getIncomeLineRefundableCap(line);
  const factor = getPartialRefundReportFactor(line.refundedAt, line.refundedAmount, cap);

  return {
    amount: scaleMoney(line.amount, factor),
    channelCommission: scaleMoney(line.channelCommission, factor),
    grossIncome: scaleMoney(line.grossIncome, factor),
    netIncome: scaleMoney(line.netIncome, factor),
    taxBreakdown: line.taxBreakdown.map((item) => ({
      ...item,
      amount: scaleMoney(item.amount, factor),
    })),
  };
}

/** Lease rent schedule: month is paid when a non-deleted line has reportable net income > 0. */
export function isIncomeLinePaidForRentSchedule(
  line: Pick<
    IPropertyIncomeLine,
    | "amount"
    | "channelCommission"
    | "grossIncome"
    | "isDeleted"
    | "netIncome"
    | "refundedAmount"
    | "refundedAt"
    | "taxBreakdown"
  >
): boolean {
  if (line.isDeleted) {
    return false;
  }

  return getReportableIncomeLineAmounts(line).netIncome > 0;
}

/** Validates a refund request body amount against the refundable cap. */
export function validateRefundAmount(
  body: IRefundLedgerEntryBody | undefined,
  cap: number
): { amount: number; ok: true } | { error: string; ok: false } {
  if (body?.amount === undefined) {
    if (cap <= 0) {
      return { error: "Cannot refund an entry with zero refundable amount", ok: false };
    }
    return { amount: cap, ok: true };
  }

  const amount = body.amount;
  if (!Number.isFinite(amount)) {
    return { error: "amount must be a number", ok: false };
  }

  const roundedAmount = roundMoney(amount);
  if (roundedAmount <= 0) {
    return { error: "amount must be greater than zero", ok: false };
  }

  if (cap <= 0) {
    return { error: "Cannot refund an entry with zero refundable amount", ok: false };
  }

  if (roundedAmount > cap) {
    return { error: `amount cannot exceed ${cap}`, ok: false };
  }

  return { amount: roundedAmount, ok: true };
}
