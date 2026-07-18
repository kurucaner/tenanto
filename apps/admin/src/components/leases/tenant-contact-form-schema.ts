import { z } from "zod";

import { personNameSchema } from "@/packages/app-ui";
import {
  type ICreateSecondaryOccupantBody,
  type IPropertyLongStaySecondaryTenant,
  isValidE164,
  isValidTenantEmail,
  type IUpdateSecondaryOccupantBody,
  normalizeToE164,
} from "@/packages/shared";

export const tenantPhoneFieldSchema = z.string().refine((value) => isValidE164(value.trim()), {
  message: "Enter a valid phone number",
});

export const tenantEmailFieldSchema = z
  .string()
  .refine((value) => value.trim() === "" || isValidTenantEmail(value.trim()), {
    message: "Enter a valid email address",
  });

export const tenantContactFormSchema = z.object({
  name: personNameSchema,
  tenantEmail: tenantEmailFieldSchema,
  tenantPhone: tenantPhoneFieldSchema,
});

export type TTenantContactFormValues = z.infer<typeof tenantContactFormSchema>;

function normalizeTenantPhone(value: string): string | null {
  return normalizeToE164(value.trim()) ?? null;
}

export function toSecondaryOccupantBody(
  values: TTenantContactFormValues
): ICreateSecondaryOccupantBody {
  return {
    email: values.tenantEmail.trim() || null,
    name: values.name,
    phone: normalizeTenantPhone(values.tenantPhone),
  };
}

export function toSecondaryOccupantPatch(
  values: TTenantContactFormValues
): IUpdateSecondaryOccupantBody {
  return {
    email: values.tenantEmail.trim() || null,
    name: values.name,
    phone: normalizeTenantPhone(values.tenantPhone),
  };
}

export function toSecondaryTenant(
  values: TTenantContactFormValues
): IPropertyLongStaySecondaryTenant {
  return {
    email: values.tenantEmail.trim() || null,
    name: values.name,
    phone: normalizeTenantPhone(values.tenantPhone),
  };
}

export function toPrimaryTenantPatch(values: TTenantContactFormValues) {
  return {
    guestName: values.name,
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
