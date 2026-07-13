import { Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, memo } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CsvFileDropzoneProps {
  isDragOver: boolean;
  maxFiles: number;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export const CsvFileDropzone = memo(
  ({
    isDragOver,
    maxFiles,
    onDragLeave,
    onDragOver,
    onDrop,
    onFileInputChange,
  }: CsvFileDropzoneProps) => (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8",
        isDragOver && "border-ring bg-muted/30"
      )}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Upload className="text-muted-foreground size-5" />
      <p className="text-muted-foreground text-sm">Drag CSV files here or choose files below.</p>
      <Label className="cursor-pointer">
        <span className="text-primary text-sm font-medium">Choose CSV files</span>
        <input
          accept=".csv,text/csv"
          className="sr-only"
          multiple
          onChange={onFileInputChange}
          type="file"
        />
      </Label>
      <p className="text-muted-foreground text-xs">CSV only · up to {maxFiles} files · 1 MB each</p>
    </div>
  )
);
CsvFileDropzone.displayName = "CsvFileDropzone";
