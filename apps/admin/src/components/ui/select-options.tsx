import { memo } from "react";

import { type TSelectOption } from "@/lib/select-option-types";

interface SelectOptionsProps {
  emptyOptionLabel?: string;
  options: readonly TSelectOption[];
}

export const SelectOptions = memo(({ emptyOptionLabel, options }: SelectOptionsProps) => (
  <>
    {emptyOptionLabel ? <option value="">{emptyOptionLabel}</option> : null}
    {options.map((option) => (
      <option disabled={option.disabled} key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </>
));
SelectOptions.displayName = "SelectOptions";
