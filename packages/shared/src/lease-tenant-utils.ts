import type { IPropertyLongStay } from "./property-long-stay-types";

export function getLeaseOccupancyNames(
  lease: Pick<IPropertyLongStay, "guestName" | "secondaryTenants">
): string[] {
  return [lease.guestName, ...lease.secondaryTenants.map((tenant) => tenant.name)];
}
