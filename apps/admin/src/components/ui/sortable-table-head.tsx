import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { memo } from "react";

import { TableHead } from "@/components/ui/table";
import type { TAriaSort, TSortDirection } from "@/lib/table-sort";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  align?: "left" | "right";
  ariaSort: TAriaSort;
  direction: TSortDirection | null;
  label: string;
  onSort: () => void;
  sortable?: boolean;
}

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
    label,
    onSort,
    sortable = true,
  }: SortableTableHeadProps) => {
    if (!sortable) {
      return (
        <TableHead className={align === "right" ? "text-right" : undefined}>{label}</TableHead>
      );
    }

    return (
      <TableHead aria-sort={ariaSort} className={align === "right" ? "text-right" : undefined}>
        <button
          className={cn(
            "inline-flex items-center gap-1 rounded-sm font-medium transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            align === "right" && "ml-auto"
          )}
          onClick={onSort}
          type="button"
        >
          {label}
          <SortIcon direction={direction} />
        </button>
      </TableHead>
    );
  }
);
SortableTableHead.displayName = "SortableTableHead";
