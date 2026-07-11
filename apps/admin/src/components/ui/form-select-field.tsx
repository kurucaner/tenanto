import { type ComponentProps,memo } from "react";

import { FieldLabel } from "@/components/ui/field-label";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { type TSelectOption } from "@/lib/select-option-types";

interface FormSelectFieldProps extends Omit<ComponentProps<typeof NativeSelect>, "id"> {
  children?: ComponentProps<typeof NativeSelect>["children"];
  error?: string;
  id: string;
  label: string;
  optional?: boolean;
  options?: readonly TSelectOption[];
  useFieldLabel?: boolean;
}

export const FormSelectField = memo(
  ({
    children,
    error,
    id,
    label,
    optional = false,
    options,
    useFieldLabel = false,
    ...selectProps
  }: FormSelectFieldProps) => (
    <div className="flex flex-col gap-1.5">
      {useFieldLabel ? (
        <FieldLabel htmlFor={id} optional={optional}>
          {label}
        </FieldLabel>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      <NativeSelect id={id} options={options} {...selectProps}>
        {children}
      </NativeSelect>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
);
FormSelectField.displayName = "FormSelectField";
