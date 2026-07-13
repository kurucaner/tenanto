import type { IPropertyLongStay } from "./property-long-stay-types";
import {
  type ITenantEmailRecipientResolution,
  type ITenantEmailResolvedRecipient,
  type ITenantEmailSkippedRecipient,
  TenantEmailTenantRole,
  type TTenantEmailTenantRole,
} from "./tenant-email-campaign-types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeTenantEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidTenantEmail(email: string): boolean {
  const normalized = normalizeTenantEmail(email);
  if (normalized.length === 0 || normalized.length > 320) {
    return false;
  }
  return EMAIL_RE.test(normalized);
}

function pushSkipped(
  skipped: ITenantEmailSkippedRecipient[],
  entry: ITenantEmailSkippedRecipient
): void {
  skipped.push(entry);
}

function pushRecipient(
  recipients: ITenantEmailResolvedRecipient[],
  seenEmails: Set<string>,
  skipped: ITenantEmailSkippedRecipient[],
  entry: {
    email: string | null | undefined;
    leaseId: string;
    tenantName: string;
    tenantRole: TTenantEmailTenantRole;
  }
): void {
  const rawEmail = entry.email?.trim() ?? "";
  if (rawEmail === "") {
    pushSkipped(skipped, {
      leaseId: entry.leaseId,
      reason: "Missing email address",
      tenantName: entry.tenantName,
      tenantRole: entry.tenantRole,
    });
    return;
  }

  if (!isValidTenantEmail(rawEmail)) {
    pushSkipped(skipped, {
      leaseId: entry.leaseId,
      reason: "Invalid email address",
      tenantName: entry.tenantName,
      tenantRole: entry.tenantRole,
    });
    return;
  }

  const normalized = normalizeTenantEmail(rawEmail);
  if (seenEmails.has(normalized)) {
    pushSkipped(skipped, {
      leaseId: entry.leaseId,
      reason: "Duplicate email address in campaign audience",
      tenantName: entry.tenantName,
      tenantRole: entry.tenantRole,
    });
    return;
  }

  seenEmails.add(normalized);
  recipients.push({
    email: normalized,
    leaseId: entry.leaseId,
    tenantName: entry.tenantName,
    tenantRole: entry.tenantRole,
  });
}

export function resolveTenantEmailRecipients(
  leases: readonly Pick<
    IPropertyLongStay,
    "guestName" | "id" | "secondaryTenants" | "status" | "tenantEmail"
  >[]
): ITenantEmailRecipientResolution {
  const recipients: ITenantEmailResolvedRecipient[] = [];
  const skipped: ITenantEmailSkippedRecipient[] = [];
  const seenEmails = new Set<string>();

  for (const lease of leases) {
    if (lease.status !== "active") {
      continue;
    }

    pushRecipient(recipients, seenEmails, skipped, {
      email: lease.tenantEmail,
      leaseId: lease.id,
      tenantName: lease.guestName,
      tenantRole: TenantEmailTenantRole.PRIMARY,
    });

    for (const secondaryTenant of lease.secondaryTenants) {
      pushRecipient(recipients, seenEmails, skipped, {
        email: secondaryTenant.email,
        leaseId: lease.id,
        tenantName: secondaryTenant.name,
        tenantRole: TenantEmailTenantRole.SECONDARY,
      });
    }
  }

  return { recipients, skipped };
}
