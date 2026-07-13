import { FileSpreadsheet, Trash2 } from "lucide-react";
import { memo, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { type ISelectedCsvFile } from "@/lib/csv-file-import";

interface SelectedCsvFileItemProps {
  entry: ISelectedCsvFile;
  onRemove: (fileId: string) => void;
}

export const SelectedCsvFileItem = memo(({ entry, onRemove }: SelectedCsvFileItemProps) => {
  const handleRemove = useCallback(() => {
    onRemove(entry.id);
  }, [entry.id, onRemove]);

  return (
    <li className="flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <FileSpreadsheet className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate" title={entry.file.name}>
          {entry.file.name}
        </span>
      </div>
      <Button
        aria-label={`Remove ${entry.file.name}`}
        onClick={handleRemove}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
});
SelectedCsvFileItem.displayName = "SelectedCsvFileItem";
