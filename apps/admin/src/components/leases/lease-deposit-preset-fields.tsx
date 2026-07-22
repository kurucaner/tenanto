import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
  useWatch,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
                  <div className="flex flex-col gap-1.5 pl-6">
                    <Label htmlFor={customAmountFieldId}>Custom amount</Label>
                    <div className="relative max-w-xs">
                      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                        $
                      </span>
                      <Controller
                        control={control}
                        name={"securityDepositCustomAmount" as FieldPath<TFieldValues>}
                        render={({ field: customField }) => (
                          <Input
                            className="pl-7 tabular-nums"
                            id={customAmountFieldId}
                            inputMode="decimal"
                            onChange={(e) => {
                              if (isValidDecimalInput(e.target.value)) {
                                customField.onChange(e.target.value);
                              }
                            }}
                            type="text"
                            value={customField.value}
                          />
                        )}
                      />
                    </div>
                    {customAmountError ? (
                      <p className="text-destructive text-xs">{customAmountError}</p>
                    ) : null}
                  </div>
                ) : null}
              </RadioOption>
            ))}
          </RadioGroupFieldset>
        )}
      />
      {securityDepositPreset === LeaseDepositPreset.ONE_MONTH_RENT ? (
        <p className="text-muted-foreground text-xs">
          Saves the current rent amount as a fixed deposit snapshot (not recalculated later).
        </p>
      ) : null}
    </div>
  );
}
