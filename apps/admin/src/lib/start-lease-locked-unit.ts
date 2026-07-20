import {
  type IPropertyLongStay,
  type IPropertyUnit,
  UnitRentalType,
} from "@/packages/shared";

export function resolveStartLeaseLockedUnit(input: {
  activeLeases: IPropertyLongStay[];
  unitIdParam: string;
  units: IPropertyUnit[];
}): { error: string | null; unit: IPropertyUnit | null } {
  const { activeLeases, unitIdParam, units } = input;
  if (!unitIdParam) {
    return { error: null, unit: null };
  }

  const unit = units.find((item) => item.id === unitIdParam);
  if (!unit) {
    return { error: "Unit not found.", unit: null };
  }
  if (unit.isDeleted) {
    return { error: "This unit has been deleted.", unit: null };
  }
  if (unit.rentalType !== UnitRentalType.LONG_TERM) {
    return { error: "Only long-term units can have leases.", unit: null };
  }
  if (activeLeases.some((lease) => lease.unitId === unit.id)) {
    return { error: "This unit already has an active lease.", unit: null };
  }

  return { error: null, unit };
}
