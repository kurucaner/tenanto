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

/** Fixed name for the server-managed lease rent type (not shown in property settings). */
export const SYSTEM_LEASE_RENT_INCOME_TYPE_NAME = "Long-term rent";

/** Fixed name for the server-managed security deposit type (not shown in property settings). */
export const SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME = "Security deposit";

/** User-managed misc income types seeded for new properties (excludes system types). */
export const DEFAULT_PROPERTY_INCOME_LINE_TYPES: Pick<IPropertyIncomeLineTypeInput, "name">[] = [
  { name: "Extra cleaning" },
  { name: "Beach equipment rental" },
];

export const DEFAULT_EXTRA_CLEANING_TYPE_NAME = "Extra cleaning";

/** @deprecated Legacy default name; migration v72 renames system rows to {@link SYSTEM_LEASE_RENT_INCOME_TYPE_NAME}. */
export const DEFAULT_RENT_TYPE_NAME = "Rent";

export function resolveDefaultIncomeLineTypeId(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): string {
  const extraCleaning = types.find(
    (type) => type.name.toLowerCase() === DEFAULT_EXTRA_CLEANING_TYPE_NAME.toLowerCase()
  );
  return extraCleaning?.id ?? types[0]?.id ?? "";
}

/**
 * Legacy client helper for lease rent type id from settings types.
 * Prefer server-side `ensureLeaseRentIncomeLineType` for lease-linked writes.
 */
export function resolveLeaseIncomeLineTypeId(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): string {
  const systemType = types.find(
    (type) => type.name.toLowerCase() === SYSTEM_LEASE_RENT_INCOME_TYPE_NAME.toLowerCase()
  );
  if (systemType != null) {
    return systemType.id;
  }

  const rent = types.find(
    (type) => type.name.toLowerCase() === DEFAULT_RENT_TYPE_NAME.toLowerCase()
  );
  return rent?.id ?? types[0]?.id ?? "";
}

/** @deprecated Prefer server-side lease rent type resolution for lease-linked income writes. */
export function resolveRentIncomeLineTypeId(
  types: Pick<IPropertyIncomeLineType, "id" | "name">[]
): string {
  return resolveLeaseIncomeLineTypeId(types);
}

export function isRentIncomeLineType(type: Pick<IPropertyIncomeLineType, "name">): boolean {
  const normalized = type.name.toLowerCase();
  return (
    normalized === SYSTEM_LEASE_RENT_INCOME_TYPE_NAME.toLowerCase() ||
    normalized === DEFAULT_RENT_TYPE_NAME.toLowerCase()
  );
}

export function isSystemLeaseRentIncomeLineTypeName(name: string): boolean {
  return name.toLowerCase() === SYSTEM_LEASE_RENT_INCOME_TYPE_NAME.toLowerCase();
}

export function isSystemSecurityDepositIncomeLineTypeName(name: string): boolean {
  return name.toLowerCase() === SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME.toLowerCase();
}
