import { memo, useCallback, useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { formatMoney } from "@/lib/format-money";

import { type TRefundEntryMode } from "./use-refund-entry-form";

interface RefundEntryFieldsProps {
  cap: number;
  fullOptionLabel?: string;
  mode: TRefundEntryMode;
  onModeChange: (mode: TRefundEntryMode) => void;
  onPartialAmountChange: (value: string) => void;
  partialAmount: string;
  partialOptionLabel?: string;
}

export const RefundEntryFields = memo(
  ({
    cap,
    fullOptionLabel = "Full refund",
    mode,
    onModeChange,
    onPartialAmountChange,
    partialAmount,
    partialOptionLabel = "Partial refund",
  }: RefundEntryFieldsProps) => {
    const amountInputId = useId();

    const handlePartialAmountChange = useCallback(
      (value: string) => {
        if (isValidDecimalInput(value)) {
          onPartialAmountChange(value);
        }
      },
      [onPartialAmountChange]
    );

    return (
      <RadioGroupFieldset
        legend="Refund type"
        onValueChange={(value) => onModeChange(value as TRefundEntryMode)}
        value={mode}
      >
        <RadioOption label={fullOptionLabel} value="full" />
        <RadioOption label={partialOptionLabel} value="partial">
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
    );
  }
);
RefundEntryFields.displayName = "RefundEntryFields";
