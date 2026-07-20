import {
  Controller,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from "react-hook-form";
import { type z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { isValidIntegerInput } from "@/lib/integer-input-utils";
import {
  isCustomLeaseEndDate,
  type LeaseTermInputMode,
  resolveLeaseEndDate,
  validateLeaseTermInput,
} from "@/packages/shared";

export type TLeaseTermEndFormValues = {
  leaseEndDate: string;
  leaseStartDate: string;
  termMode: LeaseTermInputMode;
  termMonths: string;
};

type TLeaseTermEndFieldsProps<TFieldValues extends FieldValues & TLeaseTermEndFormValues> = {
  control: Control<TFieldValues>;
  endDateFieldId: string;
  errors: FieldErrors<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  startDateFieldId: string;
  termMonthsFieldId: string;
};

export function LeaseTermEndFields<TFieldValues extends FieldValues & TLeaseTermEndFormValues>({
  control,
  endDateFieldId,
  errors,
  register,
  startDateFieldId,
  termMonthsFieldId,
}: TLeaseTermEndFieldsProps<TFieldValues>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={startDateFieldId}>Lease Start Date</Label>
        <Input id={startDateFieldId} type="date" {...register("leaseStartDate")} />
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
            <RadioOption label="Term (months)" value="months">
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

export function refineLeaseTermEndFormValues(
  values: TLeaseTermEndFormValues,
  ctx: z.RefinementCtx,
  errorPath: "leaseEndDate" | "termMonths" = "termMonths"
): void {
  if (values.termMode === "customEnd" && values.leaseEndDate === "") {
    ctx.addIssue({
      code: "custom",
      message: "Lease end date is required",
      path: ["leaseEndDate"],
    });
    return;
  }

  const payload = buildLeaseTermApiPayload(values);
  const error = validateLeaseTermInput(payload);
  if (error) {
    ctx.addIssue({
      code: "custom",
      message: error,
      path: [values.termMode === "customEnd" ? "leaseEndDate" : errorPath],
    });
  }
}

export function buildLeaseTermApiPayload(values: TLeaseTermEndFormValues): {
  leaseEndDate?: string;
  leaseStartDate: string;
  termMonths?: number;
} {
  if (values.termMode === "customEnd") {
    return {
      leaseEndDate: values.leaseEndDate,
      leaseStartDate: values.leaseStartDate,
    };
  }

  return {
    leaseStartDate: values.leaseStartDate,
    termMonths: Number.parseInt(values.termMonths, 10),
  };
}

export function resolveLeaseTermEndPreview(values: TLeaseTermEndFormValues): string | null {
  try {
    return resolveLeaseEndDate(buildLeaseTermApiPayload(values)).leaseEndDate;
  } catch {
    return null;
  }
}

export function getInitialLeaseTermEndValues(input: {
  leaseEndDate: string;
  leaseStartDate: string;
  termMonths: number;
}): TLeaseTermEndFormValues {
  const usesCustomEnd = isCustomLeaseEndDate(
    input.leaseStartDate,
    input.termMonths,
    input.leaseEndDate
  );

  return {
    leaseEndDate: input.leaseEndDate,
    leaseStartDate: input.leaseStartDate,
    termMode: usesCustomEnd ? "customEnd" : "months",
    termMonths: String(input.termMonths),
  };
}
