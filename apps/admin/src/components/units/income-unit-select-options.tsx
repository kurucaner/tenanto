import { memo } from "react";

import { PROPERTY_AMENITY_UNIT_VALUE } from "@/lib/property-amenity-unit";
import {
  formatPropertyUnitSelectLabel,
  type IPropertyUnit,
  PROPERTY_AMENITY_UNIT_LABEL,
} from "@/packages/shared";

interface IncomeUnitSelectOptionsProps {
  emptyOptionLabel?: string;
  includePropertyAmenityOption?: boolean;
  units: IPropertyUnit[];
}

export const IncomeUnitSelectOptions = memo(
  ({ emptyOptionLabel, includePropertyAmenityOption, units }: IncomeUnitSelectOptionsProps) => (
    <>
      {emptyOptionLabel ? <option value="">{emptyOptionLabel}</option> : null}
      {includePropertyAmenityOption ? (
        <option value={PROPERTY_AMENITY_UNIT_VALUE}>{PROPERTY_AMENITY_UNIT_LABEL}</option>
      ) : null}
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {formatPropertyUnitSelectLabel(unit)}
        </option>
      ))}
    </>
  )
);
IncomeUnitSelectOptions.displayName = "IncomeUnitSelectOptions";
