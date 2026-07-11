import { type ComponentProps, memo } from "react";

import { FilterField } from "@/components/filters/filter-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateFilterFieldProps extends Omit<ComponentProps<typeof Input>, "id" | "type"> {
  id: string;
  label: string;
}

export const DateFilterField = memo(({ id, label, ...inputProps }: DateFilterFieldProps) => (
  <FilterField>
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type="date" {...inputProps} />
  </FilterField>
));
DateFilterField.displayName = "DateFilterField";
