import { type FieldErrors } from "react-hook-form";
import { z } from "zod";

import { personNameSchema } from "@/packages/app-ui";
import {
  type ICreateSecondaryOccupantBody,
  type IPropertyLongStaySecondaryTenant,
  isValidE164,
  isValidTenantEmail,
  type IUpdateSecondaryOccupantBody,
  normalizeTenantEmail,
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

export function getTenantContactFormErrorMessage(
  errors: FieldErrors<TTenantContactFormValues>
): string {
  return (
    errors.tenantEmail?.message ??
    errors.name?.message ??
    errors.tenantPhone?.message ??
    "Fix the highlighted fields"
  );
}

function buildBlockedEmailSet(
  blockedEmails: readonly (string | null | undefined)[] | undefined
): Set<string> {
  const blocked = new Set<string>();
  for (const email of blockedEmails ?? []) {
    if (email?.trim()) {
      blocked.add(normalizeTenantEmail(email));
    }
  }
  return blocked;
}

export function createTenantContactFormSchema(options?: {
  blockedEmails?: readonly (string | null | undefined)[];
}) {
  const blocked = buildBlockedEmailSet(options?.blockedEmails);
  if (blocked.size === 0) {
    return tenantContactFormSchema;
  }

  return tenantContactFormSchema.superRefine((values, ctx) => {
    const trimmed = values.tenantEmail.trim();
    if (!trimmed) {
      return;
    }

    if (blocked.has(normalizeTenantEmail(trimmed))) {
      ctx.addIssue({
        code: "custom",
        message: "Email cannot match the primary tenant's email",
        path: ["tenantEmail"],
      });
    }
  });
}

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
