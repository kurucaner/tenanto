import { Plus } from "lucide-react";
import { memo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PropertySettingsCatalogListProps {
  addLabel: string;
  children: ReactNode;
  count: number;
  description?: string;
  disabled?: boolean;
  emptyLabel: string;
  onAdd: () => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  showSearch: boolean;
  title?: string;
}

export const PropertySettingsCatalogList = memo(function PropertySettingsCatalogList({
  addLabel,
  children,
  count,
  description,
  disabled = false,
  emptyLabel,
  onAdd,
  onSearchChange,
  searchQuery,
  showSearch,
  title,
}: PropertySettingsCatalogListProps) {
  return (
    <div className="space-y-3">
      {title || description ? (
        <div>
          {title ? <h3 className="text-sm font-medium">{title}</h3> : null}
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium">
          {count} {count === 1 ? "item" : "items"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {showSearch ? (
            <Input
              className="h-8 w-44"
              disabled={disabled}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search…"
              value={searchQuery}
            />
          ) : null}
          <Button
            className="gap-1.5"
            disabled={disabled}
            onClick={onAdd}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="size-3.5" />
            {addLabel}
          </Button>
        </div>
      </div>

      {count === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <ul className="divide-y rounded-lg border">{children}</ul>
      )}
    </div>
  );
});
PropertySettingsCatalogList.displayName = "PropertySettingsCatalogList";
