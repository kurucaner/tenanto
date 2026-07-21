import { ChevronsUpDown } from "lucide-react";
import { memo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface PropertySwitcherTriggerProps {
  children: ReactNode;
  label: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  searchField: ReactNode;
}

export const PropertySwitcherTrigger = memo(
  ({ children, label, onOpenChange, open, searchField }: PropertySwitcherTriggerProps) => (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          className="h-auto max-w-[min(100%,16rem)] gap-1.5 px-2 py-1.5 text-sm font-medium text-foreground sm:max-w-xs"
          type="button"
          variant="outline"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(calc(100vw-2rem),20rem)] p-0">
        <div className="border-border border-b p-2">{searchField}</div>
        <div aria-label="Properties" className="max-h-64 overflow-y-auto p-1">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  )
);
PropertySwitcherTrigger.displayName = "PropertySwitcherTrigger";
