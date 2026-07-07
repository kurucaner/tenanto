import { memo } from "react";

import { formatPropertyUnitSelectLabel, type IPropertyUnit } from "@/packages/shared";

interface PropertyUnitSelectOptionsProps {
  includeEmptyOption?: boolean;
  units: IPropertyUnit[];
}

export const PropertyUnitSelectOptions = memo(
  ({ includeEmptyOption = false, units }: PropertyUnitSelectOptionsProps) => (
    <>
      {includeEmptyOption ? <option value="">Select unit…</option> : null}
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {formatPropertyUnitSelectLabel(unit)}
        </option>
      ))}
    </>
  )
);
PropertyUnitSelectOptions.displayName = "PropertyUnitSelectOptions";
