import type { IPropertyLongStay } from "./property-long-stay-types";

export function getLeaseOccupancyNames(
  lease: Pick<IPropertyLongStay, "guestName" | "secondaryTenants"> & {
    secondaryOccupantNames?: readonly string[];
  }
): string[] {
  const secondaryNames =
    lease.secondaryOccupantNames ?? lease.secondaryTenants.map((tenant) => tenant.name);
  return [lease.guestName, ...secondaryNames];
}
