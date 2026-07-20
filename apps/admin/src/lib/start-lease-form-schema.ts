import { type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import {
  refineLeaseTermEndFormValues,
} from "@/components/leases/lease-term-end-fields";
import { tenantPhoneFieldSchema } from "@/components/leases/tenant-contact-form-schema";
import { requiredPositiveMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { type TStartLeaseStep } from "@/lib/start-lease-steps";
import { createPersonNameSchema } from "@/packages/app-ui";

export const DEFAULT_START_LEASE_TERM_MONTHS = "12";

const startLeaseWhoStepSchema = z.object({
  guestName: createPersonNameSchema({ requiredMessage: "Primary tenant name is required" }),
  tenantEmail: z.string(),
  tenantPhone: tenantPhoneFieldSchema,
  unitId: z.string().min(1, "Unit is required"),
});

const startLeaseTermStepSchema = z
  .object({
    leaseEndDate: z.string(),
    leaseStartDate: z.string().min(1, "Lease start date is required"),
    termMode: z.enum(["months", "customEnd"]),
    termMonths: z.string(),
  })
  .superRefine((values, ctx) => {
    refineLeaseTermEndFormValues(values, ctx);
  });

const startLeaseRentStepSchema = z.object({
  monthlyRent: requiredPositiveMoneyField("Monthly rent"),
});

export const startLeaseSchema = z
  .object({
    guestName: createPersonNameSchema({ requiredMessage: "Primary tenant name is required" }),
    leaseEndDate: z.string(),
    leaseStartDate: z.string().min(1, "Lease start date is required"),
    monthlyRent: requiredPositiveMoneyField("Monthly rent"),
    tenantEmail: z.string(),
    tenantPhone: tenantPhoneFieldSchema,
    termMode: z.enum(["months", "customEnd"]),
    termMonths: z.string(),
    unitId: z.string().min(1, "Unit is required"),
  })
  .superRefine((values, ctx) => {
    refineLeaseTermEndFormValues(values, ctx);
  });

export type TStartLeaseFormValues = z.infer<typeof startLeaseSchema>;

export type TStartLeaseFormField = keyof TStartLeaseFormValues;

export const START_LEASE_STEP_FIELDS: Record<TStartLeaseStep, readonly TStartLeaseFormField[]> = {
  rent: ["monthlyRent"],
  term: ["leaseStartDate", "termMode", "termMonths", "leaseEndDate"],
  who: ["unitId", "guestName", "tenantEmail", "tenantPhone"],
};

export function getStartLeaseStepSchema(step: TStartLeaseStep) {
  if (step === "who") {
    return startLeaseWhoStepSchema;
  }

  if (step === "term") {
    return startLeaseTermStepSchema;
  }

  return startLeaseRentStepSchema;
}

export function applyStartLeaseStepValidationErrors(
  form: UseFormReturn<TStartLeaseFormValues>,
  step: TStartLeaseStep,
  error: z.ZodError
): void {
  form.clearErrors(START_LEASE_STEP_FIELDS[step]);
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") {
      continue;
    }
    if (!(field in START_LEASE_STEP_FIELDS[step])) {
      continue;
    }
    form.setError(field as TStartLeaseFormField, { message: issue.message });
  }
}

export function validateStartLeaseStep(step: TStartLeaseStep, values: TStartLeaseFormValues) {
  return getStartLeaseStepSchema(step).safeParse(values);
}

export function getStartLeaseDefaultValues(unitId?: string): TStartLeaseFormValues {
  return {
    guestName: "",
    leaseEndDate: "",
    leaseStartDate: getTodayLocalIsoDate(),
    monthlyRent: "",
    tenantEmail: "",
    tenantPhone: "",
    termMode: "months",
    termMonths: DEFAULT_START_LEASE_TERM_MONTHS,
    unitId: unitId ?? "",
  };
}
