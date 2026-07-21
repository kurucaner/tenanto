import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { HttpStatus } from "@/packages/shared";

export const TenantEmailCampaignErrorCode = {
  IDEMPOTENCY_CONFLICT: "TENANT_EMAIL_CAMPAIGN_IDEMPOTENCY_CONFLICT",
  NO_RECIPIENTS: "TENANT_EMAIL_CAMPAIGN_NO_RECIPIENTS",
  NOT_FOUND: "TENANT_EMAIL_CAMPAIGN_NOT_FOUND",
  VALIDATION: "TENANT_EMAIL_CAMPAIGN_VALIDATION",
} as const;

export type TTenantEmailCampaignErrorCode =
  (typeof TenantEmailCampaignErrorCode)[keyof typeof TenantEmailCampaignErrorCode];

const TENANT_EMAIL_CAMPAIGN_ERROR_CODES = new Set<string>(
  Object.values(TenantEmailCampaignErrorCode)
);

export function isTenantEmailCampaignDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && TENANT_EMAIL_CAMPAIGN_ERROR_CODES.has(error.code);
}

export function getTenantEmailCampaignIdempotencyConflictId(error: unknown): string | null {
  if (isDomainError(error) && error.code === TenantEmailCampaignErrorCode.IDEMPOTENCY_CONFLICT) {
    const existingCampaignId = error.body?.existingCampaignId;
    return typeof existingCampaignId === "string" ? existingCampaignId : null;
  }
  return null;
}

export function tenantEmailCampaignValidationError(message: string): DomainError {
  return createDomainError(
    TenantEmailCampaignErrorCode.VALIDATION,
    message,
    HttpStatus.BAD_REQUEST
  );
}

export function tenantEmailCampaignNoRecipientsError(
  message = "No deliverable tenant email recipients found"
): DomainError {
  return createDomainError(
    TenantEmailCampaignErrorCode.NO_RECIPIENTS,
    message,
    HttpStatus.BAD_REQUEST
  );
}

export function tenantEmailCampaignNotFoundError(message = "Campaign not found"): DomainError {
  return createDomainError(TenantEmailCampaignErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
}

export function tenantEmailCampaignIdempotencyConflictError(
  existingCampaignId: string
): DomainError {
  return createDomainError(
    TenantEmailCampaignErrorCode.IDEMPOTENCY_CONFLICT,
    "Tenant email campaign idempotency conflict",
    HttpStatus.CONFLICT,
    { existingCampaignId }
  );
}
