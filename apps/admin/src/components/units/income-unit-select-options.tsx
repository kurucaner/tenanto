import { memo } from "react";

import {
  formatPropertyUnitSelectLabel,
  type IPropertyUnit,
  PROPERTY_AMENITY_UNIT_LABEL,
} from "@/packages/shared";

// Sentinel <select> value for the "Property Amenity" choice (income not tied to a unit).
// Not a UUID, so it never collides with a real unit id; the dialog maps it to unitId: null.
export const PROPERTY_AMENITY_UNIT_VALUE = "__property_amenity__";

interface IncomeUnitSelectOptionsProps {
  emptyOptionLabel?: string;
  includePropertyAmenityOption?: boolean;
  units: IPropertyUnit[];
}

export const IncomeUnitSelectOptions = memo(
  ({ emptyOptionLabel, includePropertyAmenityOption, units }: IncomeUnitSelectOptionsProps) => (
    <>
      {emptyOptionLabel ? <option value="">{emptyOptionLabel}</option> : null}
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {formatPropertyUnitSelectLabel(unit)}
        </option>
      ))}
      {includePropertyAmenityOption ? (
        <option value={PROPERTY_AMENITY_UNIT_VALUE}>{PROPERTY_AMENITY_UNIT_LABEL}</option>
      ) : null}
    </>
  )
);
IncomeUnitSelectOptions.displayName = "IncomeUnitSelectOptions";
