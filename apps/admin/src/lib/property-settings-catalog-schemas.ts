import { z } from "zod";

import { PROPERTY_SETTINGS_NAME_MAX_LENGTH } from "@/lib/property-settings-form-types";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(PROPERTY_SETTINGS_NAME_MAX_LENGTH, `Name must be at most ${PROPERTY_SETTINGS_NAME_MAX_LENGTH} characters`);

const ratePercentSchema = z
  .string()
  .trim()
  .min(1, "Rate is required")
  .refine((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  }, "Rate must be a number between 0 and 100");

export const channelCommissionFormSchema = z.object({
  excludeCleaningFromCommissionBase: z.boolean(),
  excludeResortTaxFromPayout: z.boolean(),
  name: nameSchema,
  ratePercent: ratePercentSchema,
});

export type TChannelCommissionFormValues = z.infer<typeof channelCommissionFormSchema>;

export const taxRateFormSchema = z.object({
  name: nameSchema,
  ratePercent: ratePercentSchema,
});

export type TTaxRateFormValues = z.infer<typeof taxRateFormSchema>;

export const expenseCategoryFormSchema = z.object({
  isAnnualAmount: z.boolean(),
  name: nameSchema,
});

export type TExpenseCategoryFormValues = z.infer<typeof expenseCategoryFormSchema>;

export const incomeLineTypeFormSchema = z.object({
  name: nameSchema,
});

export type TIncomeLineTypeFormValues = z.infer<typeof incomeLineTypeFormSchema>;
