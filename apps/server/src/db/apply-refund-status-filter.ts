import type { TIncomeRefundFilter } from "@/packages/shared";
import { IncomeRefundFilter } from "@/packages/shared";

export function applyRefundStatusFilter(
  tableAlias: "pil" | "pr",
  refundStatus: TIncomeRefundFilter | undefined,
  conditions: string[]
): void {
  if (refundStatus === IncomeRefundFilter.REFUNDED) {
    conditions.push(`${tableAlias}.refunded_at IS NOT NULL`);
  }
  if (refundStatus === IncomeRefundFilter.NOT_REFUNDED) {
    conditions.push(`${tableAlias}.refunded_at IS NULL`);
  }
}
