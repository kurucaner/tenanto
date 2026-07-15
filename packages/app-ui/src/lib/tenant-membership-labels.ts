import type { TTenantMembershipRole, TTenantMembershipStatus } from "@/packages/shared";

export function formatTenantMembershipRole(role: TTenantMembershipRole): string {
  return role === "primary" ? "Primary tenant" : "Secondary tenant";
}

export function formatTenantMembershipStatus(status: TTenantMembershipStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending_acceptance":
      return "Pending acceptance";
    case "pending_invite":
      return "Pending invite";
    case "declined":
      return "Declined";
    case "ended":
      return "Ended";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
}
