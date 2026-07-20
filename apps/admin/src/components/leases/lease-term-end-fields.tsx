import {
  type Control,
  Controller,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { formatIsoDateDisplay } from "@/lib/format-iso-date";
import { isValidIntegerInput } from "@/lib/integer-input-utils";
import { type TLeaseTermEndFormValues } from "@/lib/lease-term-end-utils";
import { type LeaseTermInputMode } from "@/packages/shared";

type TLeaseTermEndFieldsProps<TFieldValues extends FieldValues & TLeaseTermEndFormValues> = {
  control: Control<TFieldValues>;
  endDateFieldId: string;
  errors: FieldErrors<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  resolvedEndDate?: string | null;
  startDateFieldId: string;
  termMonthsFieldId: string;
};

export function LeaseTermEndFields<TFieldValues extends FieldValues & TLeaseTermEndFormValues>({
  control,
  endDateFieldId,
  errors,
  register,
  resolvedEndDate = null,
  startDateFieldId,
  termMonthsFieldId,
}: Readonly<TLeaseTermEndFieldsProps<TFieldValues>>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={startDateFieldId}>Lease Start Date</Label>
        <Input
          id={startDateFieldId}
          type="date"
          {...register("leaseStartDate" as Path<TFieldValues>)}
        />
        {errors.leaseStartDate ? (
          <p className="text-xs text-destructive">{String(errors.leaseStartDate.message)}</p>
        ) : null}
      </div>

      <Controller
        control={control}
        name={"termMode" as never}
        render={({ field: termModeField }) => (
          <RadioGroupFieldset
            legend="Lease length"
            onValueChange={(value) => termModeField.onChange(value as LeaseTermInputMode)}
            value={termModeField.value}
          >
            <RadioOption label="Number of months" value="months">
              <div className="flex flex-col gap-1.5 pl-6">
                <Controller
                  control={control}
                  name={"termMonths" as never}
                  render={({ field }) => (
                    <Input
                      disabled={termModeField.value !== "months"}
                      id={termMonthsFieldId}
                      inputMode="numeric"
                      onChange={(event) => {
                        if (isValidIntegerInput(event.target.value)) {
                          field.onChange(event.target.value);
                        }
                      }}
                      type="text"
                      value={field.value}
                    />
                  )}
                />
                {errors.termMonths ? (
                  <p className="text-xs text-destructive">{String(errors.termMonths.message)}</p>
                ) : null}
                {termModeField.value === "months" && resolvedEndDate ? (
                  <p className="text-muted-foreground text-sm">
                    Lease ends {formatIsoDateDisplay(resolvedEndDate)}
                  </p>
                ) : null}
              </div>
            </RadioOption>
            <RadioOption label="End date" value="customEnd">
              <div className="flex flex-col gap-1.5 pl-6">
                <Controller
                  control={control}
                  name={"leaseEndDate" as never}
                  render={({ field }) => (
                    <Input
                      disabled={termModeField.value !== "customEnd"}
                      id={endDateFieldId}
                      onChange={field.onChange}
                      type="date"
                      value={field.value}
                    />
                  )}
                />
                {errors.leaseEndDate ? (
                  <p className="text-xs text-destructive">{String(errors.leaseEndDate.message)}</p>
                ) : null}
              </div>
            </RadioOption>
          </RadioGroupFieldset>
        )}
      />

      <p className="text-muted-foreground text-xs">
        Rent is calculated through the end date you set (inclusive).
      </p>
    </div>
  );
}
