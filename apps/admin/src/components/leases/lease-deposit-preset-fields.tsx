import { type ChangeEvent } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
  useWatch,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { START_LEASE_DEPOSIT_PRESET_LABELS } from "@/lib/start-lease-deposit-field";
import {
  LEASE_DEPOSIT_PRESETS,
  LeaseDepositPreset,
  type TLeaseDepositPreset,
} from "@/packages/shared";

type TLeaseDepositFormValues = {
  securityDepositCustomAmount: string;
  securityDepositPreset: TLeaseDepositPreset;
};

type TLeaseDepositPresetFieldsProps<TFieldValues extends FieldValues & TLeaseDepositFormValues> = {
  control: Control<TFieldValues>;
  customAmountError?: string;
  customAmountFieldId: string;
  legend?: string;
};

type TLeaseDepositCustomAmountFieldProps<
  TFieldValues extends FieldValues & TLeaseDepositFormValues,
> = {
  control: Control<TFieldValues>;
  customAmountError?: string;
  customAmountFieldId: string;
};

function handleCustomAmountChange(
  onChange: (value: string) => void,
  event: ChangeEvent<HTMLInputElement>
): void {
  if (isValidDecimalInput(event.target.value)) {
    onChange(event.target.value);
  }
}

function LeaseDepositCustomAmountField<
  TFieldValues extends FieldValues & TLeaseDepositFormValues,
>({
  control,
  customAmountError,
  customAmountFieldId,
}: Readonly<TLeaseDepositCustomAmountFieldProps<TFieldValues>>) {
  return (
    <div className="flex flex-col gap-1.5 pl-6">
      <div className="relative max-w-xs">
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
          $
        </span>
        <Controller
          control={control}
          name={"securityDepositCustomAmount" as FieldPath<TFieldValues>}
          render={({ field }) => (
            <Input
              className="pl-7 tabular-nums"
              id={customAmountFieldId}
              inputMode="decimal"
              onChange={(event) => handleCustomAmountChange(field.onChange, event)}
              type="text"
              value={field.value}
            />
          )}
        />
      </div>
      {customAmountError ? <p className="text-destructive text-xs">{customAmountError}</p> : null}
    </div>
  );
}

export function LeaseDepositPresetFields<
  TFieldValues extends FieldValues & TLeaseDepositFormValues,
>({
  control,
  customAmountError,
  customAmountFieldId,
  legend = "Security deposit",
}: Readonly<TLeaseDepositPresetFieldsProps<TFieldValues>>) {
  const securityDepositPreset = useWatch({
    control,
    name: "securityDepositPreset" as FieldPath<TFieldValues>,
  }) as TLeaseDepositPreset;

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{legend}</p>
      <Controller
        control={control}
        name={"securityDepositPreset" as FieldPath<TFieldValues>}
        render={({ field }) => (
          <RadioGroupFieldset legend={legend} onValueChange={field.onChange} value={field.value}>
            {LEASE_DEPOSIT_PRESETS.map((preset) => (
              <RadioOption
                key={preset}
                label={START_LEASE_DEPOSIT_PRESET_LABELS[preset]}
                value={preset}
              >
                {preset === LeaseDepositPreset.CUSTOM ? (
                  <LeaseDepositCustomAmountField
                    control={control}
                    customAmountError={customAmountError}
                    customAmountFieldId={customAmountFieldId}
                  />
                ) : null}
              </RadioOption>
            ))}
          </RadioGroupFieldset>
        )}
      />
      {securityDepositPreset === LeaseDepositPreset.ONE_MONTH_RENT ? (
        <p className="text-muted-foreground text-xs">
          Sets the deposit to the current rent amount. If you raise rent when extending, you can opt
          in to top up the deposit to match.
        </p>
      ) : null}
    </div>
  );
}
