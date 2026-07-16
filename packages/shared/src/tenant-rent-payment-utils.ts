import type { ITenantLeaseBalancePeriod } from "./tenant-rent-payment-types";

/** Stripe's minimum charge for USD (card). */
export const STRIPE_MIN_CHARGE_CENTS_USD = 50;

/** Convert ledger dollars (NUMERIC) to integer cents for Stripe. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert Stripe cents to ledger dollars. */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** Checkout idempotency key — same tenant/lease/months/amount reuses an open payment. */
export function buildRentCheckoutIdempotencyKey(input: {
  amountCents: number;
  leaseId: string;
  periodMonths: string[];
  tenantUserId: string;
}): string {
  const months = [...input.periodMonths].sort((a, b) => a.localeCompare(b)).join(",");
  return `rent_checkout:${input.leaseId}:${input.tenantUserId}:${months}:${input.amountCents}`;
}

const PERIOD_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface IRentPeriodInput {
  expectedCents: number;
  month: string;
  paidCents: number;
}

export interface IRentAllocation {
  allocatedCents: number;
  expectedCentsSnapshot: number;
  month: string;
}

export type TValidateRentCheckoutResult =
  { allocations: IRentAllocation[]; ok: true } | { error: string; ok: false };

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** Remaining due for one month (never negative). */
export function computePeriodRemainingCents(expectedCents: number, paidCents: number): number {
  if (!isNonNegativeInt(expectedCents) || !isNonNegativeInt(paidCents)) {
    return 0;
  }
  return Math.max(0, expectedCents - paidCents);
}

/** Map schedule rows → balance periods with remaining. */
export function computeRemainingByMonth(periods: IRentPeriodInput[]): ITenantLeaseBalancePeriod[] {
  return periods.map((period) => {
    const expectedCents = isNonNegativeInt(period.expectedCents) ? period.expectedCents : 0;
    const paidCents = isNonNegativeInt(period.paidCents) ? period.paidCents : 0;
    return {
      expectedCents,
      month: period.month,
      paidCents,
      remainingCents: computePeriodRemainingCents(expectedCents, paidCents),
    };
  });
}

/**
 * Default "amount due": sum remaining for months ≤ `asOfMonth` (YYYY-MM).
 * When `asOfMonth` is omitted, includes all months with remaining > 0.
 */
export function sumAmountDueCents(
  periods: ITenantLeaseBalancePeriod[],
  asOfMonth?: string
): number {
  return periods.reduce((sum, period) => {
    if (period.remainingCents <= 0) {
      return sum;
    }
    if (asOfMonth !== undefined && period.month > asOfMonth) {
      return sum;
    }
    return sum + period.remainingCents;
  }, 0);
}

export function isValidPeriodMonth(month: string): boolean {
  return PERIOD_MONTH_RE.test(month);
}

/**
 * Allocate `amountCents` FIFO across selected months (chronological YYYY-MM order).
 * Stops when amount is exhausted; never allocates more than each month's remaining.
 */
export function allocateFifo(
  amountCents: number,
  selectedPeriods: Array<{ expectedCents: number; month: string; remainingCents: number }>
): IRentAllocation[] {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return [];
  }

  const ordered = [...selectedPeriods].sort((a, b) => a.month.localeCompare(b.month));
  let remaining = amountCents;
  const allocations: IRentAllocation[] = [];

  for (const period of ordered) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(remaining, Math.max(0, period.remainingCents));
    if (take <= 0) {
      continue;
    }
    allocations.push({
      allocatedCents: take,
      expectedCentsSnapshot: period.expectedCents,
      month: period.month,
    });
    remaining -= take;
  }

  return allocations;
}

/**
 * Validate checkout body against recomputed period remaining.
 * Allocation is FIFO across selected months when valid.
 */
export function validateCreateRentCheckoutBody(input: {
  amountCents: number;
  currency?: string;
  leaseId: string;
  minChargeCents?: number;
  periodMonths: string[];
  periods: ITenantLeaseBalancePeriod[];
}): TValidateRentCheckoutResult {
  const minCharge = input.minChargeCents ?? STRIPE_MIN_CHARGE_CENTS_USD;
  const leaseId = input.leaseId.trim();
  if (!leaseId) {
    return { error: "leaseId is required", ok: false };
  }

  if (!Array.isArray(input.periodMonths) || input.periodMonths.length === 0) {
    return { error: "periodMonths must include at least one month", ok: false };
  }

  const uniqueMonths = new Set<string>();
  for (const month of input.periodMonths) {
    if (!isValidPeriodMonth(month)) {
      return { error: `Invalid period month: ${month}`, ok: false };
    }
    if (uniqueMonths.has(month)) {
      return { error: `Duplicate period month: ${month}`, ok: false };
    }
    uniqueMonths.add(month);
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents < minCharge) {
    return {
      error: `amountCents must be an integer ≥ ${minCharge}`,
      ok: false,
    };
  }

  const byMonth = new Map(input.periods.map((p) => [p.month, p]));
  const selected: Array<{ expectedCents: number; month: string; remainingCents: number }> = [];

  for (const month of uniqueMonths) {
    const period = byMonth.get(month);
    if (!period) {
      return { error: `Unknown period month: ${month}`, ok: false };
    }
    if (period.remainingCents <= 0) {
      return { error: `Period ${month} has nothing remaining`, ok: false };
    }
    selected.push({
      expectedCents: period.expectedCents,
      month,
      remainingCents: period.remainingCents,
    });
  }

  const maxCents = selected.reduce((sum, p) => sum + p.remainingCents, 0);
  if (input.amountCents > maxCents) {
    return {
      error: `amountCents (${input.amountCents}) exceeds remaining for selected periods (${maxCents})`,
      ok: false,
    };
  }

  const allocations = allocateFifo(input.amountCents, selected);
  const allocatedSum = allocations.reduce((sum, a) => sum + a.allocatedCents, 0);
  if (allocatedSum !== input.amountCents) {
    return { error: "Could not fully allocate amountCents across selected periods", ok: false };
  }

  return { allocations, ok: true };
}
