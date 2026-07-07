import { memo } from "react";

import { formatPropertyUnitSelectLabel, type IPropertyUnit } from "@/packages/shared";

interface PropertyUnitSelectOptionsProps {
  emptyOptionLabel?: string;
  units: IPropertyUnit[];
}

export const PropertyUnitSelectOptions = memo(
  ({ emptyOptionLabel, units }: PropertyUnitSelectOptionsProps) => (
    <>
      {emptyOptionLabel ? <option value="">{emptyOptionLabel}</option> : null}
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {formatPropertyUnitSelectLabel(unit)}
        </option>
      ))}
    </>
  )
);
PropertyUnitSelectOptions.displayName = "PropertyUnitSelectOptions";
