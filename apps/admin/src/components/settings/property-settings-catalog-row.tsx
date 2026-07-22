import { Pencil } from "lucide-react";
import { memo, type MouseEvent, type ReactNode } from "react";

import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { TableIconButton } from "@/components/table/table-icon-button";

export interface PropertySettingsCatalogRowProps {
  disabled?: boolean;
  isDeletePending?: boolean;
  meta?: ReactNode;
  onDelete?: (event?: MouseEvent<HTMLButtonElement>) => void;
  onEdit?: () => void;
  quickDeleteActive: boolean;
  showDelete?: boolean;
  showEdit?: boolean;
  title: string;
}

export const PropertySettingsCatalogRow = memo(function PropertySettingsCatalogRow({
  disabled = false,
  isDeletePending = false,
  meta,
  onDelete,
  onEdit,
  quickDeleteActive,
  showDelete = true,
  showEdit = true,
  title,
}: PropertySettingsCatalogRowProps) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title || "Untitled"}</p>
        {meta ? <p className="text-muted-foreground truncate text-xs">{meta}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {showEdit && onEdit != null ? (
          <TableIconButton
            ariaLabel={`Edit ${title || "item"}`}
            disabled={disabled || isDeletePending}
            onClick={onEdit}
            tooltip="Edit"
          >
            <Pencil className="size-3.5" />
          </TableIconButton>
        ) : null}
        {showDelete && onDelete != null ? (
          <QuickDeleteButton
            ariaLabel={`Remove ${title || "item"}`}
            disabled={disabled || isDeletePending}
            onClick={onDelete}
            quickDeleteActive={quickDeleteActive}
          />
        ) : null}
      </div>
    </li>
  );
});
PropertySettingsCatalogRow.displayName = "PropertySettingsCatalogRow";
