import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DataTableToolbarProps {
  activeFilters?: ReactNode;
  className?: string;
  controls?: ReactNode;
  controlsClassName?: string;
  countLabel?: string;
  search?: ReactNode;
}

export const DataTableToolbar = memo(
  ({
    activeFilters,
    className,
    controls,
    controlsClassName,
    countLabel,
    search,
  }: DataTableToolbarProps) => (
    <div className={cn("space-y-2 border-b px-3 py-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search ? <div className="min-w-[min(100%,16rem)] flex-1">{search}</div> : null}
        {controls ? (
          <div className={cn("flex flex-wrap items-center gap-2", controlsClassName)}>
            {controls}
          </div>
        ) : null}
        {countLabel ? (
          <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">
            {countLabel}
          </span>
        ) : null}
      </div>
      {activeFilters}
    </div>
  )
);
DataTableToolbar.displayName = "DataTableToolbar";
