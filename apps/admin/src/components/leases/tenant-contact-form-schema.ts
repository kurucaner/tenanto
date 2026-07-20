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

export const DUPLICATE_SECONDARY_TENANT_EMAIL_MESSAGE =
  "This email is already used by another secondary tenant on this lease";

export const PRIMARY_TENANT_EMAIL_MATCH_MESSAGE =
  "Email cannot match the primary tenant's email";

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

function buildNormalizedEmailSet(
  emails: readonly (string | null | undefined)[] | undefined,
  excludeEmail?: string | null
): Set<string> {
  const normalized = new Set<string>();
  const excluded =
    excludeEmail?.trim() !== "" && excludeEmail != null
      ? normalizeTenantEmail(excludeEmail.trim())
      : null;

  for (const email of emails ?? []) {
    if (!email?.trim()) {
      continue;
    }
    const normalizedEmail = normalizeTenantEmail(email.trim());
    if (excluded != null && normalizedEmail === excluded) {
      continue;
    }
    normalized.add(normalizedEmail);
  }

  return normalized;
}

function normalizeOptionalTenantEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) {
    return null;
  }
  return normalizeTenantEmail(email.trim());
}

export function createTenantContactFormSchema(options?: {
  excludeEmail?: string | null;
  primaryTenantEmail?: string | null;
  secondaryTenantEmails?: readonly (string | null | undefined)[];
}) {
  const normalizedPrimary = normalizeOptionalTenantEmail(options?.primaryTenantEmail);
  const normalizedSecondaries = buildNormalizedEmailSet(
    options?.secondaryTenantEmails,
    options?.excludeEmail
  );

  if (normalizedPrimary == null && normalizedSecondaries.size === 0) {
    return tenantContactFormSchema;
  }

  return tenantContactFormSchema.superRefine((values, ctx) => {
    const trimmed = values.tenantEmail.trim();
    if (!trimmed) {
      return;
    }

    const normalizedInput = normalizeTenantEmail(trimmed);

    if (normalizedPrimary != null && normalizedInput === normalizedPrimary) {
      ctx.addIssue({
        code: "custom",
        message: PRIMARY_TENANT_EMAIL_MATCH_MESSAGE,
        path: ["tenantEmail"],
      });
      return;
    }

    if (normalizedSecondaries.has(normalizedInput)) {
      ctx.addIssue({
        code: "custom",
        message: DUPLICATE_SECONDARY_TENANT_EMAIL_MESSAGE,
        path: ["tenantEmail"],
      });
    }
  });
}

export function getSecondaryTenantMutationErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error) {
    if ((error as Error & { code?: string }).code === "PORTAL_INVITE_DUPLICATE") {
      return DUPLICATE_SECONDARY_TENANT_EMAIL_MESSAGE;
    }
    return error.message;
  }
  return fallback;
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
