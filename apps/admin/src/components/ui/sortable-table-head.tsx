import { ChevronDown, ChevronsUpDown, ChevronUp, Info } from "lucide-react";
import { memo } from "react";

import { TableHead } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TAriaSort, TSortDirection } from "@/lib/table-sort";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  align?: "left" | "right";
  ariaSort: TAriaSort;
  direction: TSortDirection | null;
  info?: string;
  label: string;
  onSort: () => void;
  sortable?: boolean;
}

const ColumnInfoTooltip = memo(({ label, text }: { label: string; text: string }) => (
  <Tooltip>
    <TooltipTrigger
      aria-label={`${label} calculation`}
      className="inline-flex text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      type="button"
    >
      <Info aria-hidden className="size-3.5 shrink-0" />
    </TooltipTrigger>
    <TooltipContent>{text}</TooltipContent>
  </Tooltip>
));
ColumnInfoTooltip.displayName = "ColumnInfoTooltip";

const SortIcon = memo(({ direction }: { direction: TSortDirection | null }) => {
  if (direction === "asc") {
    return <ChevronUp aria-hidden className="size-3.5 shrink-0 opacity-80" />;
  }
  if (direction === "desc") {
    return <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-80" />;
  }
  return <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 opacity-40" />;
});
SortIcon.displayName = "SortIcon";

export const SortableTableHead = memo(
  ({
    align = "left",
    ariaSort,
    direction,
    info,
    label,
    onSort,
    sortable = true,
  }: SortableTableHeadProps) => {
    if (!sortable) {
      return (
        <TableHead className={align === "right" ? "text-right" : undefined}>
          <span className="inline-flex items-center gap-1">
            {label}
            {info ? <ColumnInfoTooltip label={label} text={info} /> : null}
          </span>
        </TableHead>
      );
    }

    return (
      <TableHead aria-sort={ariaSort} className={align === "right" ? "text-right" : undefined}>
        <span className={cn("inline-flex items-center gap-1", align === "right" && "justify-end")}>
          {info ? <ColumnInfoTooltip label={label} text={info} /> : null}
          <button
            className={cn(
              "inline-flex items-center gap-1 rounded-sm font-medium transition-colors",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
            onClick={onSort}
            type="button"
          >
            {label}
            <SortIcon direction={direction} />
          </button>
        </span>
      </TableHead>
    );
  }
);
SortableTableHead.displayName = "SortableTableHead";
