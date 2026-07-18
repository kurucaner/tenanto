export const TEST_PROPERTY_ID = "prop-1";
export const TEST_UNIT_ID = "unit-1";
export const TEST_CHANNEL_ID = "ch000000-0000-4000-8000-000000000001";
export const TEST_INCOME_LINE_TYPE_ID = "type0000-0000-4000-8000-000000000001";
export const TEST_EXPENSE_CATEGORY_ID_1 = "cat00000-0000-4000-8000-000000000001";
export const TEST_EXPENSE_CATEGORY_ID_2 = "cat00000-0000-4000-8000-000000000002";

/** Deterministic UUID v4-shaped id: 1 → 1111…, 2 → 2222…, etc. */
export function sequentialUuid(index: number): string {
  const digit = String(index);
  return `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
}

export function sequentialUnitId(index: number): string {
  return `unit-${index}`;
}

export function labelFromIndex(index: number): string {
  return String.fromCodePoint(65 + index);
}
