import {
  type Control,
  Controller,
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
import { normalizeStartLeaseRentBillingCadence } from "@/lib/start-lease-rent-billing";
import {
  type LeaseTermInputMode,
  RentBillingCadence,
  type TRentBillingCadence,
} from "@/packages/shared";

type TLeaseTermEndFieldsProps<TFieldValues extends FieldValues & TLeaseTermEndFormValues> = {
  control: Control<TFieldValues>;
  endDateFieldId: string;
  leaseEndDateError?: string;
  leaseStartDateError?: string;
  register: UseFormRegister<TFieldValues>;
  rentBillingCadence?: TRentBillingCadence | null;
  resolvedEndDate?: string | null;
  startDateFieldId: string;
  termMonthsError?: string;
  termMonthsFieldId: string;
  termWeeksError?: string;
  termWeeksFieldId: string;
};

export function LeaseTermEndFields<TFieldValues extends FieldValues & TLeaseTermEndFormValues>({
  control,
  endDateFieldId,
  leaseEndDateError,
  leaseStartDateError,
  register,
  rentBillingCadence = RentBillingCadence.MONTHLY,
  resolvedEndDate = null,
  startDateFieldId,
  termMonthsError,
  termMonthsFieldId,
  termWeeksError,
  termWeeksFieldId,
}: Readonly<TLeaseTermEndFieldsProps<TFieldValues>>) {
  const isWeekly =
    normalizeStartLeaseRentBillingCadence(rentBillingCadence) === RentBillingCadence.WEEKLY;
  const durationMode = isWeekly ? "weeks" : "months";
  const durationLabel = isWeekly ? "Number of weeks" : "Number of months";
  const durationFieldName = isWeekly ? "termWeeks" : "termMonths";
  const durationFieldId = isWeekly ? termWeeksFieldId : termMonthsFieldId;
  const durationError = isWeekly ? termWeeksError : termMonthsError;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={startDateFieldId}>Lease Start Date</Label>
        <Input
          id={startDateFieldId}
          type="date"
          {...register("leaseStartDate" as Path<TFieldValues>)}
        />
        {leaseStartDateError ? (
          <p className="text-xs text-destructive">{leaseStartDateError}</p>
        ) : null}
      </div>

      <Controller
        control={control}
        name={"termMode" as never}
        render={({ field: termModeField }) => {
          const isDurationModeActive =
            termModeField.value === durationMode ||
            (isWeekly && termModeField.value === "months") ||
            (!isWeekly && termModeField.value === "weeks");

          return (
            <RadioGroupFieldset
              legend="Lease length"
              onValueChange={(value) => termModeField.onChange(value as LeaseTermInputMode)}
              value={termModeField.value === "customEnd" ? "customEnd" : durationMode}
            >
              <RadioOption label={durationLabel} value={durationMode}>
                <div className="flex flex-col gap-1.5 pl-6">
                  <Controller
                    control={control}
                    name={durationFieldName as never}
                    render={({ field }) => (
                      <Input
                        disabled={!isDurationModeActive}
                        id={durationFieldId}
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
                  {durationError ? (
                    <p className="text-xs text-destructive">{durationError}</p>
                  ) : null}
                  {isDurationModeActive && resolvedEndDate ? (
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
                  {leaseEndDateError ? (
                    <p className="text-xs text-destructive">{leaseEndDateError}</p>
                  ) : null}
                </div>
              </RadioOption>
            </RadioGroupFieldset>
          );
        }}
      />

      <p className="text-muted-foreground text-xs">
        Rent is calculated through the end date you set (inclusive).
      </p>
    </div>
  );
}
