import { z } from "zod";

import { normalizeToE164 } from "@/packages/shared";

export const tenantSmsSettingsFormSchema = z.object({
  otp: z.string().refine((value) => value.trim().length >= 4, {
    message: "Enter the verification code",
  }),
  phone: z
    .string()
    .min(1, "Enter a mobile phone number")
    .refine((value) => normalizeToE164(value) != null, {
      message: "Enter a valid phone number",
    }),
  smsConsent: z.boolean().refine((value) => value, {
    message: "You must agree to receive SMS alerts",
  }),
});

export type TTenantSmsSettingsFormValues = z.infer<typeof tenantSmsSettingsFormSchema>;

export function tenantSmsSettingsFormDefaults(phone: string | null | undefined): TTenantSmsSettingsFormValues {
  return {
    otp: "",
    phone: phone ?? "",
    smsConsent: false,
  };
}
