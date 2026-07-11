import { type ComponentProps,memo } from "react";

import { SelectOptions } from "@/components/ui/select-options";
import { type TSelectOption } from "@/lib/select-option-types";
import { cn } from "@/lib/utils";

const nativeSelectClassName = cn(
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

interface NativeSelectProps extends ComponentProps<"select"> {
  emptyOptionLabel?: string;
  options?: readonly TSelectOption[];
}

export const NativeSelect = memo(
  ({ children, className, emptyOptionLabel, options, ...props }: NativeSelectProps) => (
    <select className={cn(nativeSelectClassName, className)} {...props}>
      {options ? (
        <SelectOptions emptyOptionLabel={emptyOptionLabel} options={options} />
      ) : emptyOptionLabel ? (
        <option value="">{emptyOptionLabel}</option>
      ) : null}
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";
