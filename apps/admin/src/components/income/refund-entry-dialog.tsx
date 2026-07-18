import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { formatMoney } from "@/lib/format-money";
import { parseRefundAmountInput } from "@/lib/parse-refund-amount-input";

export type TRefundEntryMode = "full" | "partial";

export type TRefundEntryConfirmPayload =
  { amount?: undefined; mode: "full" } | { amount: number; mode: "partial" };

interface RefundEntryDialogProps {
  cap: number;
  description: string;
  isPending?: boolean;
  onConfirm: (payload: TRefundEntryConfirmPayload) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export const RefundEntryDialog = memo(
  ({
    cap,
    description,
    isPending = false,
    onConfirm,
    onOpenChange,
    open,
    title,
  }: RefundEntryDialogProps) => {
    const amountInputId = useId();
    const [mode, setMode] = useState<TRefundEntryMode>("full");
    const [partialAmount, setPartialAmount] = useState("");

    useEffect(() => {
      if (!open) {
        return;
      }
      setMode("full");
      setPartialAmount("");
    }, [open]);

    const parsedPartialAmount = useMemo(
      () => (mode === "partial" ? parseRefundAmountInput(partialAmount, cap) : null),
      [cap, mode, partialAmount]
    );

    const canSubmit = mode === "full" || parsedPartialAmount?.ok === true;

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen && isPending) {
          return;
        }
        onOpenChange(nextOpen);
      },
      [isPending, onOpenChange]
    );

    const handlePartialAmountChange = useCallback((value: string) => {
      if (isValidDecimalInput(value)) {
        setPartialAmount(value);
      }
    }, []);

    const handleConfirm = useCallback(() => {
      if (mode === "full") {
        onConfirm({ mode: "full" });
        return;
      }

      if (!parsedPartialAmount?.ok) {
        return;
      }

      onConfirm({ amount: parsedPartialAmount.amount, mode: "partial" });
    }, [mode, onConfirm, parsedPartialAmount]);

    const handleModeChange = useCallback((nextValue: string) => {
      setMode(nextValue as TRefundEntryMode);
    }, []);

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[400px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogFormFields>
            <RadioGroupFieldset legend="Refund type" onValueChange={handleModeChange} value={mode}>
              <RadioOption label="Full refund" value="full" />
              <RadioOption label="Partial refund" value="partial">
                <div className="ml-6 space-y-1.5">
                  <Label htmlFor={amountInputId}>Refund amount</Label>
                  <Input
                    autoFocus
                    id={amountInputId}
                    inputMode="decimal"
                    onChange={(event) => handlePartialAmountChange(event.target.value)}
                    placeholder="0.00"
                    value={partialAmount}
                  />
                  <p className="text-muted-foreground text-xs">Max refund: {formatMoney(cap)}</p>
                </div>
              </RadioOption>
            </RadioGroupFieldset>
          </DialogFormFields>

          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending || !canSubmit} onClick={handleConfirm} type="button">
              {isPending ? "Refund…" : "Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
RefundEntryDialog.displayName = "RefundEntryDialog";
