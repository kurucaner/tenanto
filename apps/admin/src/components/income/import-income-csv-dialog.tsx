import { memo, useCallback } from "react";

import { ImportCsvDialogShell } from "@/components/csv-import/import-csv-dialog-shell";
import { ImportCsvUploadFooter } from "@/components/csv-import/import-csv-upload-footer";
import { ImportCsvUploadStep } from "@/components/csv-import/import-csv-upload-step";
import { useCsvFileSelection } from "@/hooks/use-csv-file-selection";
import {
  EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_FILES,
} from "@/packages/shared";

const CSV_IMPORT_LIMITS = {
  maxBytesPerFile: EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  maxFiles: EXPENSE_CSV_IMPORT_MAX_FILES,
};

interface ImportIncomeCsvDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const ImportIncomeCsvDialog = memo(({ onOpenChange, open }: ImportIncomeCsvDialogProps) => {
  const {
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
    isDragOver,
    removeFile,
    reset,
    selectedFiles,
  } = useCsvFileSelection({ limits: CSV_IMPORT_LIMITS });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset]
  );

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  return (
    <ImportCsvDialogShell
      description="Upload CSV files from booking channels or bank exports. Smart read and preview are coming soon."
      footer={
        <ImportCsvUploadFooter
          onCancel={handleCancel}
          onSmartRead={() => {}}
          selectedFileCount={selectedFiles.length}
          smartReadDisabled
          smartReadDisabledReason="Income CSV import is coming soon"
        />
      }
      onOpenChange={handleOpenChange}
      open={open}
      title="Import Income from CSV"
    >
      <ImportCsvUploadStep
        isDragOver={isDragOver}
        maxFiles={EXPENSE_CSV_IMPORT_MAX_FILES}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onFileInputChange={handleFileInputChange}
        onRemoveFile={removeFile}
        selectedFiles={selectedFiles}
      />
    </ImportCsvDialogShell>
  );
});
ImportIncomeCsvDialog.displayName = "ImportIncomeCsvDialog";
