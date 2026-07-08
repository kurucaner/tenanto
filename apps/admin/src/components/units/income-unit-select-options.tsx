import { memo } from "react";

import { formatPropertyUnitSelectLabel, type IPropertyUnit } from "@/packages/shared";

interface IncomeUnitSelectOptionsProps {
  emptyOptionLabel?: string;
  units: IPropertyUnit[];
}

export const IncomeUnitSelectOptions = memo(
  ({ emptyOptionLabel, units }: IncomeUnitSelectOptionsProps) => (
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
IncomeUnitSelectOptions.displayName = "IncomeUnitSelectOptions";
