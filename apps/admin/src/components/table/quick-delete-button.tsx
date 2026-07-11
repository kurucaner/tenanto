import { Trash2 } from "lucide-react";
import { memo, type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
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
    <Button
      aria-keyshortcuts="Shift+Click"
      aria-label={ariaLabel}
      className={cn(quickDeleteActive && "bg-muted text-foreground dark:bg-muted/50")}
      disabled={disabled}
      onClick={onClick}
      size="icon-sm"
      title={`Hold ${getPrimaryModifierKeyLabel()} to delete without confirmation`}
      type="button"
      variant="ghost"
    >
      <Trash2 className="size-3.5 text-destructive" />
    </Button>
  )
);
QuickDeleteButton.displayName = "QuickDeleteButton";
