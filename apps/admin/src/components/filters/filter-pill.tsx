import { type ComponentProps, memo } from "react";

import { cn } from "@/lib/utils";

interface FilterPillProps extends Omit<ComponentProps<"button">, "type"> {
  selected?: boolean;
}

export const FilterPill = memo(({ className, selected = false, ...props }: FilterPillProps) => (
  <button
    aria-pressed={selected}
    className={cn(
      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
      selected
        ? "border-foreground bg-foreground text-background"
        : "border-input text-muted-foreground hover:border-foreground hover:text-foreground",
      className
    )}
    type="button"
    {...props}
  />
));
FilterPill.displayName = "FilterPill";
