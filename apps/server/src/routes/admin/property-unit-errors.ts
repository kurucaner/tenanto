import type { IUnitDeleteBlockers } from "@/db/property-units";
import { UnitKind, type TUnitKind } from "@/packages/shared";

export const UNIT_DELETE_FOREIGN_KEY_FALLBACK =
  "This unit cannot be deleted because it is linked to reservations or income records";

export function duplicateUnitNumberMessage(unitKind: TUnitKind): string {
  return unitKind === UnitKind.AMENITY
    ? "An amenity with this name already exists on this property"
    : "A unit with this number already exists on this property";
}

export function formatUnitDeleteBlockedMessage(blockers: IUnitDeleteBlockers): string {
  const { incomeLineCount, reservationCount } = blockers;
  if (reservationCount > 0 && incomeLineCount > 0) {
    return "This unit cannot be deleted because it has reservation and income records";
  }
  if (reservationCount > 0) {
    const label = reservationCount === 1 ? "record" : "records";
    return `This unit cannot be deleted because it has ${reservationCount} reservation ${label}`;
  }
  if (incomeLineCount > 0) {
    const label = incomeLineCount === 1 ? "record" : "records";
    return `This unit cannot be deleted because it has ${incomeLineCount} income ${label}`;
  }
  return UNIT_DELETE_FOREIGN_KEY_FALLBACK;
}

export function getUnitDeleteBlockerCode(blockers: IUnitDeleteBlockers): string | undefined {
  if (blockers.reservationCount > 0 && blockers.incomeLineCount > 0) {
    return "UNIT_IN_USE";
  }
  if (blockers.reservationCount > 0) {
    return "UNIT_HAS_RESERVATIONS";
  }
  if (blockers.incomeLineCount > 0) {
    return "UNIT_HAS_INCOME";
  }
  return undefined;
}
