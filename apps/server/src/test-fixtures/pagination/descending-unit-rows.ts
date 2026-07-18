import { testDateTime } from "../dates";
import { buildUnitRow, UNIT_PAGINATION_COUNT_ROW } from "../db-rows/unit-row";
import { sequentialUuid } from "../ids";

const UNIT_SPECS = [
  { layout: "1BR", rentalType: "short_term", unitNumber: "101" },
  { layout: "2BR", rentalType: "short_term", unitNumber: "102" },
  { layout: "Studio", rentalType: "long_term", unitNumber: "201" },
] as const;

export function buildDescendingUnitRows(): Record<string, unknown>[] {
  return UNIT_SPECS.map((spec, rowIndex) => {
    const dayOffset = -rowIndex;

    return buildUnitRow({
      created_at: testDateTime(dayOffset),
      id: sequentialUuid(rowIndex + 1),
      layout: spec.layout,
      rental_type: spec.rentalType,
      unit_number: spec.unitNumber,
      updated_at: testDateTime(dayOffset),
    });
  });
}

export { UNIT_PAGINATION_COUNT_ROW };
