import { Trash2 } from "lucide-react";
import { memo, type MouseEvent } from "react";

import { TableIconButton } from "@/components/table/table-icon-button";
import { getPrimaryModifierKeyLabel } from "@/lib/primary-modifier-key";
import { cn } from "@/lib/utils";

interface QuickDeleteButtonProps {
  ariaLabel: string;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  quickDeleteActive: boolean;
}

export const QuickDeleteButton = memo(
  ({ ariaLabel, disabled, onClick, quickDeleteActive }: QuickDeleteButtonProps) => (
    <TableIconButton
      aria-keyshortcuts="Shift+Click"
      ariaLabel={ariaLabel}
      className={cn(quickDeleteActive && "bg-muted text-foreground dark:bg-muted/50")}
      disabled={disabled}
      onClick={onClick}
      tooltip={
        <span className="flex flex-col gap-0.5">
          <span>{ariaLabel}</span>
          <span className="text-background/80">
            Hold {getPrimaryModifierKeyLabel()} to delete without confirmation
          </span>
        </span>
      }
    >
      <Trash2 className="size-3.5 text-destructive" />
    </TableIconButton>
  )
);
QuickDeleteButton.displayName = "QuickDeleteButton";
