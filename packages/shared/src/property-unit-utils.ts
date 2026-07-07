import {
  type IPropertyUnit,
  type TUnitKind,
  type TUnitRentalType,
  UnitKind,
  UnitRentalType,
} from "./property-types";

export function formatUnitRentalTypeLabel(rentalType: TUnitRentalType): string {
  return rentalType === UnitRentalType.SHORT_TERM ? "Short Term" : "Long Term";
}

export function formatUnitKindLabel(unitKind: TUnitKind): string {
  return unitKind === UnitKind.AMENITY ? "Amenity" : "Rentable";
}

export function isAmenityUnit(unit: Pick<IPropertyUnit, "unitKind">): boolean {
  return unit.unitKind === UnitKind.AMENITY;
}

export function isRentableUnit(unit: Pick<IPropertyUnit, "unitKind">): boolean {
  return unit.unitKind === UnitKind.RENTABLE;
}

export function filterRentableUnits(units: IPropertyUnit[]): IPropertyUnit[] {
  return units.filter(isRentableUnit);
}

export function filterAmenityUnits(units: IPropertyUnit[]): IPropertyUnit[] {
  return units.filter(isAmenityUnit);
}

export function formatPropertyUnitSelectLabel(
  unit: Pick<IPropertyUnit, "rentalType" | "unitKind" | "unitNumber">
): string {
  if (isAmenityUnit(unit)) {
    return unit.unitNumber;
  }
  return `${unit.unitNumber} (${formatUnitRentalTypeLabel(unit.rentalType)})`;
}
