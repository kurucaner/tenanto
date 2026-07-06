import { AdminAuditAction } from "@/packages/shared";

const ACTION_LABELS: Record<string, string> = {
  [AdminAuditAction.USER_ACCOUNT_RESET]: "Account reset (vaults cleared)",
};

export function formatAdminAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
