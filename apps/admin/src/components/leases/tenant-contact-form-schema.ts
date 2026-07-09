import { z } from "zod";

import { type IPropertyLongStaySecondaryTenant,isValidE164, normalizeToE164 } from "@/packages/shared";

export const tenantPhoneFieldSchema = z.string().refine((value) => isValidE164(value.trim()), {
  message: "Enter a valid phone number",
});

export const tenantContactFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  tenantEmail: z.string(),
  tenantPhone: tenantPhoneFieldSchema,
});

export type TTenantContactFormValues = z.infer<typeof tenantContactFormSchema>;

function normalizeTenantPhone(value: string): string | null {
  return normalizeToE164(value.trim()) ?? null;
}

export function toSecondaryTenant(values: TTenantContactFormValues): IPropertyLongStaySecondaryTenant {
  return {
    email: values.tenantEmail.trim() || null,
    name: values.name.trim(),
    phone: normalizeTenantPhone(values.tenantPhone),
  };
}

export function toPrimaryTenantPatch(values: TTenantContactFormValues) {
  return {
    guestName: values.name.trim(),
    tenantEmail: values.tenantEmail.trim() || null,
    tenantPhone: normalizeTenantPhone(values.tenantPhone),
  };
}

export function tenantContactFormDefaults(input: {
  email?: string | null;
  name: string;
  phone?: string | null;
}): TTenantContactFormValues {
  return {
    name: input.name,
    tenantEmail: input.email ?? "",
    tenantPhone: input.phone ?? "",
  };
}
