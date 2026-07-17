import { type TPropertyRole } from "@/packages/shared";

const PROPERTY_ROLE_LABELS: Record<TPropertyRole, string> = {
  accountant: "Accountant",
  manager: "Manager",
  owner: "Owner",
};

export function formatPropertyRoleLabel(role: TPropertyRole): string {
  return PROPERTY_ROLE_LABELS[role];
}
