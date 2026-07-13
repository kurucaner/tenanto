import { roundMoney } from "@/packages/shared";

export function parseRefundAmountInput(
  value: string,
  cap: number
): { amount: number; ok: true } | { ok: false } {
  if (value === "" || value === ".") {
    return { ok: false };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false };
  }

  const amount = roundMoney(parsed);
  if (amount <= 0 || amount > cap) {
    return { ok: false };
  }

  return { amount, ok: true };
}
