import { loadSecondaryOccupancyNamesByLeaseIds } from "@/db/lease-tenant-memberships";
import type { IPropertyLongStay } from "@/packages/shared";

export async function hydrateLongStaysSecondaryOccupantNames(
  longStays: readonly IPropertyLongStay[]
): Promise<IPropertyLongStay[]> {
  if (longStays.length === 0) {
    return [...longStays];
  }

  const namesByLeaseId = await loadSecondaryOccupancyNamesByLeaseIds(
    longStays.map((lease) => lease.id)
  );

  return longStays.map((lease) => {
    const secondaryOccupantNames = namesByLeaseId.get(lease.id);
    if (!secondaryOccupantNames || secondaryOccupantNames.length === 0) {
      return lease;
    }

    return {
      ...lease,
      secondaryOccupantNames,
    };
  });
}
