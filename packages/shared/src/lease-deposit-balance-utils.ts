import { roundMoney } from "./property-income-calculator";

export const LeaseDepositBalanceStatus = {
  DUE: "due",
  HELD: "held",
  NONE: "none",
  PARTIAL: "partial",
  REFUNDED: "refunded",
} as const;

export type TLeaseDepositBalanceStatus =
  (typeof LeaseDepositBalanceStatus)[keyof typeof LeaseDepositBalanceStatus];

/** Contractual + collection progress for a lease security deposit. */
export interface ILeaseDepositSummary {
  /** Gross amount recorded on deposit income lines (before refunds). */
  collected: number;
  /** Contractual amount on the lease; `null` means no deposit required. */
  expected: number | null;
  /** Remaining amount still owed toward `expected` (0 when none / fully collected). */
  outstanding: number;
  status: TLeaseDepositBalanceStatus;
}

export interface ILeaseDepositBalanceLineInput {
  amount: number;
  refundedAmount: number | null;
  refundedAt?: string | null;
}

export interface IBuildLeaseDepositSummaryInput {
  expected: number | null | undefined;
  lines: readonly ILeaseDepositBalanceLineInput[];
}

function sumMoney(values: readonly number[]): number {
  return roundMoney(values.reduce((sum, value) => sum + value, 0));
}

function lineHasRefund(line: ILeaseDepositBalanceLineInput): boolean {
  if (line.refundedAt != null) {
    return true;
  }
  return line.refundedAmount != null && line.refundedAmount > 0;
}

/**
 * Builds deposit balance from the lease contractual amount and deposit-typed income lines.
 *
 * Status rules:
 * - `none` — no expected deposit and nothing collected
 * - `due` — expected set, nothing collected
 * - `partial` — some collected but less than expected
 * - `held` — collected >= expected (or collections with no expected)
 * - `refunded` — any deposit line has a refund recorded
 */
export function buildLeaseDepositSummary(
  input: IBuildLeaseDepositSummaryInput
): ILeaseDepositSummary {
  const expected =
    input.expected === undefined || input.expected === null ? null : roundMoney(input.expected);

  const collected = sumMoney(input.lines.map((line) => line.amount));
  const outstanding = expected == null ? 0 : roundMoney(Math.max(0, expected - collected));

  if (input.lines.some(lineHasRefund)) {
    return {
      collected,
      expected,
      outstanding,
      status: LeaseDepositBalanceStatus.REFUNDED,
    };
  }

  if (expected == null) {
    if (collected <= 0) {
      return {
        collected: 0,
        expected: null,
        outstanding: 0,
        status: LeaseDepositBalanceStatus.NONE,
      };
    }
    return {
      collected,
      expected: null,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.HELD,
    };
  }

  if (collected <= 0) {
    return {
      collected: 0,
      expected,
      outstanding: expected,
      status: LeaseDepositBalanceStatus.DUE,
    };
  }

  if (collected < expected) {
    return {
      collected,
      expected,
      outstanding,
      status: LeaseDepositBalanceStatus.PARTIAL,
    };
  }

  return {
    collected,
    expected,
    outstanding: 0,
    status: LeaseDepositBalanceStatus.HELD,
  };
}
