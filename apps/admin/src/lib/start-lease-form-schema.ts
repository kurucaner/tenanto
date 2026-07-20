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
