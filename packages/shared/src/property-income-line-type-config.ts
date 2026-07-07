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

export const DEFAULT_PROPERTY_INCOME_LINE_TYPES: Pick<
  IPropertyIncomeLineTypeInput,
  "name"
>[] = [{ name: "Extra cleaning" }, { name: "Beach equipment rental" }];

export const DEFAULT_EXTRA_CLEANING_TYPE_NAME = "Extra cleaning";

export function resolveDefaultIncomeLineTypeId(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): string {
  const extraCleaning = types.find(
    (type) => type.name.toLowerCase() === DEFAULT_EXTRA_CLEANING_TYPE_NAME.toLowerCase()
  );
  return extraCleaning?.id ?? types[0]?.id ?? "";
}
