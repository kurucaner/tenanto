const CONSTRAINT_MESSAGES: Record<string, string> = {
  property_income_lines_unit_id_fkey:
    "This unit cannot be deleted because it has income records",
  property_reservations_unit_id_fkey:
    "This unit cannot be deleted because it has reservation records",
  property_units_property_id_unit_number_key:
    "A unit or amenity with this name already exists on this property",
};

const CONSTRAINT_ERROR_CODES: Record<string, string> = {
  property_income_lines_unit_id_fkey: "UNIT_HAS_INCOME",
  property_reservations_unit_id_fkey: "UNIT_HAS_RESERVATIONS",
  property_units_property_id_unit_number_key: "DUPLICATE_UNIT_NUMBER",
};

export function getConstraintMessage(constraint: string | null, fallback: string): string {
  if (constraint === null) return fallback;
  return CONSTRAINT_MESSAGES[constraint] ?? fallback;
}

export function getConstraintErrorCode(constraint: string | null): string | undefined {
  if (constraint === null) return undefined;
  return CONSTRAINT_ERROR_CODES[constraint];
}
