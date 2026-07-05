import { AdminAuditAction } from "@/packages/shared";

const ACTION_LABELS: Record<string, string> = {
  [AdminAuditAction.USER_ACCOUNT_RESET]: "Account reset (vaults cleared)",
  [AdminAuditAction.USER_FOUNDER_UPDATED]: "Founder status changed",
  [AdminAuditAction.USER_PREMIUM_UPDATED]: "Premium changed",
};

export function formatAdminAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
