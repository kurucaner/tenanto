import { type IProperty, type IPropertyUnit, UnitRentalType } from "@/packages/shared";

export function makeProperty(overrides: Partial<IProperty> = {}): IProperty {
  return {
    address: "123 Main",
    callerRole: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "operator-1",
    favoritedAt: null,
    id: "property-1",
    isFavorite: false,
    legalName: null,
    memberCount: 1,
    name: "Oak Apartments",
    phoneNumber: null,
    unitCount: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeUnit(overrides: Partial<IPropertyUnit> = {}): IPropertyUnit {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    id: "unit-1",
    isDeleted: false,
    layout: "1BR",
    propertyId: "property-1",
    rentalType: UnitRentalType.LONG_TERM,
    unitNumber: "101",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
