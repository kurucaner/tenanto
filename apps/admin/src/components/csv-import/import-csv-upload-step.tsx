import { type ChangeEvent, type DragEvent, memo } from "react";

import { CsvFileDropzone } from "@/components/csv-import/csv-file-dropzone";
import { SelectedCsvFileItem } from "@/components/csv-import/selected-csv-file-item";
import { type ISelectedCsvFile } from "@/lib/csv-file-import";

interface ImportCsvUploadStepProps {
  isDragOver: boolean;
  maxFiles: number;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (fileId: string) => void;
  selectedFiles: ISelectedCsvFile[];
}

export const ImportCsvUploadStep = memo(
  ({
    isDragOver,
    maxFiles,
    onDragLeave,
    onDragOver,
    onDrop,
    onFileInputChange,
    onRemoveFile,
    selectedFiles,
  }: ImportCsvUploadStepProps) => (
    <div className="flex flex-col gap-4">
      <CsvFileDropzone
        isDragOver={isDragOver}
        maxFiles={maxFiles}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onFileInputChange={onFileInputChange}
      />

      {selectedFiles.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {selectedFiles.map((entry) => (
            <SelectedCsvFileItem entry={entry} key={entry.id} onRemove={onRemoveFile} />
          ))}
        </ul>
      ) : null}
    </div>
  )
);
ImportCsvUploadStep.displayName = "ImportCsvUploadStep";
