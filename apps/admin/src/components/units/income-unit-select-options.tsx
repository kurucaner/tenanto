import { memo } from "react";

import {
  filterAmenityUnits,
  filterRentableUnits,
  formatPropertyUnitSelectLabel,
  type IPropertyUnit,
} from "@/packages/shared";

interface IncomeUnitSelectOptionsProps {
  emptyOptionLabel?: string;
  units: IPropertyUnit[];
}

export const IncomeUnitSelectOptions = memo(
  ({ emptyOptionLabel, units }: IncomeUnitSelectOptionsProps) => {
    const rentableUnits = filterRentableUnits(units);
    const amenityUnits = filterAmenityUnits(units);

    return (
      <>
        {emptyOptionLabel ? <option value="">{emptyOptionLabel}</option> : null}
        {rentableUnits.length > 0 ? (
          <optgroup label="Units">
            {rentableUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {formatPropertyUnitSelectLabel(unit)}
              </option>
            ))}
          </optgroup>
        ) : null}
        {amenityUnits.length > 0 ? (
          <optgroup label="Property amenities">
            {amenityUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {formatPropertyUnitSelectLabel(unit)}
              </option>
            ))}
          </optgroup>
        ) : null}
      </>
    );
  }
);
IncomeUnitSelectOptions.displayName = "IncomeUnitSelectOptions";
