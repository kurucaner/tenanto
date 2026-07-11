import { Plus } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";

export interface PropertySettingsListFooterProps {
  addLabel: string;
  disabled?: boolean;
  isSaving?: boolean;
  onAdd: () => void;
  onSave?: () => void;
  saveLabel?: string;
  showSave?: boolean;
}

export const PropertySettingsListFooter = memo(
  ({
    addLabel,
    disabled = false,
    isSaving = false,
    onAdd,
    onSave,
    saveLabel,
    showSave = false,
  }: PropertySettingsListFooterProps) => {
    return (
      <div className="flex flex-wrap gap-2">
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
        {showSave && onSave != null && saveLabel != null ? (
          <Button className="gap-1.5" disabled={disabled} onClick={onSave} size="sm" type="button">
            {isSaving ? "Saving…" : saveLabel}
          </Button>
        ) : null}
      </div>
    );
  }
);
PropertySettingsListFooter.displayName = "PropertySettingsListFooter";
