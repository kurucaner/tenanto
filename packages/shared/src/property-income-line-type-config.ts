/** Active income line type in property settings. Archived types are omitted server-side and are not exposed on the API. */
export interface IPropertyIncomeLineType {
  id: string;
  name: string;
  propertyId: string;
  sortOrder: number;
}

export interface IPropertyIncomeLineTypeInput {
  id?: string;
  name: string;
  sortOrder: number;
}

export const DEFAULT_PROPERTY_INCOME_LINE_TYPES: Pick<IPropertyIncomeLineTypeInput, "name">[] = [
  { name: "Rent" },
  { name: "Extra cleaning" },
  { name: "Beach equipment rental" },
];

export const DEFAULT_EXTRA_CLEANING_TYPE_NAME = "Extra cleaning";
export const DEFAULT_RENT_TYPE_NAME = "Rent";

export function resolveDefaultIncomeLineTypeId(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): string {
  const extraCleaning = types.find(
    (type) => type.name.toLowerCase() === DEFAULT_EXTRA_CLEANING_TYPE_NAME.toLowerCase()
  );
  return extraCleaning?.id ?? types[0]?.id ?? "";
}

export function resolveLeaseIncomeLineTypeId(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): string {
  const rent = types.find(
    (type) => type.name.toLowerCase() === DEFAULT_RENT_TYPE_NAME.toLowerCase()
  );
  return rent?.id ?? types[0]?.id ?? "";
}

/** @deprecated Prefer `resolveLeaseIncomeLineTypeId` for lease-linked income writes. */
export function resolveRentIncomeLineTypeId(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): string {
  return resolveLeaseIncomeLineTypeId(types);
}

export function isRentIncomeLineType(type: Pick<IPropertyIncomeLineType, "name">): boolean {
  return type.name.toLowerCase() === DEFAULT_RENT_TYPE_NAME.toLowerCase();
}
