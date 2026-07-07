import { UnitKind, type TUnitKind } from "@/packages/shared";

export function duplicateUnitNumberMessage(unitKind: TUnitKind): string {
  return unitKind === UnitKind.AMENITY
    ? "An amenity with this name already exists on this property"
    : "A unit with this number already exists on this property";
}
