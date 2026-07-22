import { useCallback, useMemo, useState } from "react";

import { parseRefundAmountInput } from "@/lib/parse-refund-amount-input";

export type TRefundEntryMode = "full" | "partial";

export type TRefundEntryConfirmPayload =
  { amount?: undefined; mode: "full" } | { amount: number; mode: "partial" };

export function useRefundEntryForm(options: {
  cap: number;
  onConfirm: (payload: TRefundEntryConfirmPayload) => void;
  resetToken?: string | number | boolean;
}) {
  const { cap, onConfirm, resetToken } = options;
  const [mode, setMode] = useState<TRefundEntryMode>("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [prevResetToken, setPrevResetToken] = useState(resetToken);

  if (resetToken !== prevResetToken) {
    setPrevResetToken(resetToken);
    setMode("full");
    setPartialAmount("");
  }

  const parsedPartialAmount = useMemo(
    () => (mode === "partial" ? parseRefundAmountInput(partialAmount, cap) : null),
    [cap, mode, partialAmount]
  );

  const canSubmit = mode === "full" || parsedPartialAmount?.ok === true;

  const confirm = useCallback(() => {
    if (mode === "full") {
      onConfirm({ mode: "full" });
      return;
    }

    if (!parsedPartialAmount?.ok) {
      return;
    }

    onConfirm({ amount: parsedPartialAmount.amount, mode: "partial" });
  }, [mode, onConfirm, parsedPartialAmount]);

  return {
    canSubmit,
    confirm,
    mode,
    partialAmount,
    setMode,
    setPartialAmount,
  };
}
