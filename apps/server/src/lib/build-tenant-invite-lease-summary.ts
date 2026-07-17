import type {
  ILeaseTenantMembership,
  IProperty,
  IPropertyLongStay,
  IPropertyUnit,
  ITenantInviteLeaseSummary,
} from "@/packages/shared";

export function formatUnitLabel(unit: IPropertyUnit): string {
  const number = unit.unitNumber.trim();
  const layout = unit.layout.trim();
  if (number && layout) return `${number} (${layout})`;
  return number || layout || "Unit";
}

export function buildTenantInviteLeaseSummary(
  membership: ILeaseTenantMembership,
  lease: IPropertyLongStay,
  property: IProperty,
  unit: IPropertyUnit
): ITenantInviteLeaseSummary {
  return {
    displayName: membership.displayName,
    leaseEndDate: lease.leaseEndDate,
    leaseId: lease.id,
    leaseStartDate: lease.leaseStartDate,
    propertyName: property.name,
    role: membership.role,
    unitLabel: formatUnitLabel(unit),
  };
}
