import { type IPropertyUnit, type TUnitRentalType, UnitRentalType } from "./property-types";

export function formatUnitRentalTypeLabel(rentalType: TUnitRentalType): string {
  return rentalType === UnitRentalType.SHORT_TERM ? "Short Term" : "Long Term";
}

export function formatPropertyUnitSelectLabel(
  unit: Pick<IPropertyUnit, "rentalType" | "unitNumber">
): string {
  return `${unit.unitNumber} (${formatUnitRentalTypeLabel(unit.rentalType)})`;
}
