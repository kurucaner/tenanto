import { type ComponentProps, memo } from "react";

import { FilterField } from "@/components/filters/filter-field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { type TSelectOption } from "@/lib/select-option-types";

interface FilterSelectFieldProps extends Omit<
  ComponentProps<typeof NativeSelect>,
  "id" | "options"
> {
  fieldClassName?: string;
  id: string;
  label: string;
  options?: readonly TSelectOption[];
}

export const FilterSelectField = memo(
  ({ fieldClassName, id, label, options, ...selectProps }: FilterSelectFieldProps) => (
    <FilterField className={fieldClassName}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} options={options} {...selectProps} />
    </FilterField>
  )
);
FilterSelectField.displayName = "FilterSelectField";
