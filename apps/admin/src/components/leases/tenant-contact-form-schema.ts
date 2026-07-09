import { z } from "zod";

import type { IPropertyLongStaySecondaryTenant } from "@/packages/shared";

export const tenantContactFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  tenantEmail: z.string(),
  tenantPhone: z.string(),
});

export type TTenantContactFormValues = z.infer<typeof tenantContactFormSchema>;

export function toSecondaryTenant(values: TTenantContactFormValues): IPropertyLongStaySecondaryTenant {
  return {
    email: values.tenantEmail.trim() || null,
    name: values.name.trim(),
    phone: values.tenantPhone.trim() || null,
  };
}

export function toPrimaryTenantPatch(values: TTenantContactFormValues) {
  return {
    guestName: values.name.trim(),
    tenantEmail: values.tenantEmail.trim() || null,
    tenantPhone: values.tenantPhone.trim() || null,
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
