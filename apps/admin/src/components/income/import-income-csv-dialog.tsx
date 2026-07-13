import { useMutation } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { CsvImportFileResultSummary } from "@/components/csv-import/csv-import-file-result-summary";
import { ImportCsvDialogShell } from "@/components/csv-import/import-csv-dialog-shell";
import { ImportCsvUploadFooter } from "@/components/csv-import/import-csv-upload-footer";
import { ImportCsvUploadStep } from "@/components/csv-import/import-csv-upload-step";
import { ImportIncomeCsvPreviewStep } from "@/components/income/import-income-csv-preview-step";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { useCsvFileSelection } from "@/hooks/use-csv-file-selection";
import { parseIncomeCsvFiles } from "@/lib/income-csv-import";
import {
  type IIncomeImportFileResult,
  type IIncomeImportParsedRow,
  type IIncomeImportParseResponse,
  INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE,
  INCOME_CSV_IMPORT_MAX_FILES,
} from "@/packages/shared";

type TImportStep = "preview" | "upload";

const CSV_IMPORT_LIMITS = {
  maxBytesPerFile: INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE,
  maxFiles: INCOME_CSV_IMPORT_MAX_FILES,
};

interface ImportIncomeCsvDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

function notifyIncomeImportParseOutcome(
  response: IIncomeImportParseResponse,
  rows: IIncomeImportParsedRow[]
): void {
  const irrelevantCount = response.files.filter((file) => file.status === "irrelevant").length;
  const errorCount = response.files.filter((file) => file.status === "error").length;

  if (rows.length === 0) {
    toast.info("No importable income rows were found.");
    return;
  }

  if (irrelevantCount > 0 || errorCount > 0) {
    toast.message("Some files could not be imported", {
      description: `${rows.length} row(s) ready for review.`,
    });
  }
}

const IncomeFileResultSummary = memo(({ result }: { result: IIncomeImportFileResult }) => {
  const rowCount = result.status === "parsed" ? (result.rows?.length ?? 0) : null;

  return (
    <CsvImportFileResultSummary
      fileName={result.fileName}
      message={result.message}
      rowCount={rowCount}
      rowCountLabel="stay row(s)"
      status={result.status}
    />
  );
});
IncomeFileResultSummary.displayName = "IncomeFileResultSummary";

const ImportIncomeCsvPreviewFooter = memo(
  ({ onBack, onCancel }: { onBack: () => void; onCancel: () => void }) => (
    <DialogFooter>
      <Button onClick={onCancel} type="button" variant="outline">
        Cancel
      </Button>
      <Button onClick={onBack} type="button" variant="outline">
        Back
      </Button>
    </DialogFooter>
  )
);
ImportIncomeCsvPreviewFooter.displayName = "ImportIncomeCsvPreviewFooter";

export const ImportIncomeCsvDialog = memo(
  ({ onOpenChange, open, propertyId }: ImportIncomeCsvDialogProps) => {
    const [step, setStep] = useState<TImportStep>("upload");
    const [fileResults, setFileResults] = useState<IIncomeImportFileResult[]>([]);
    const [previewRows, setPreviewRows] = useState<IIncomeImportParsedRow[]>([]);

    const {
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleFileInputChange,
      isDragOver,
      removeFile,
      reset: resetFileSelection,
      selectedFiles,
    } = useCsvFileSelection({ limits: CSV_IMPORT_LIMITS });

    const resetState = useCallback(() => {
      setStep("upload");
      resetFileSelection();
      setFileResults([]);
      setPreviewRows([]);
    }, [resetFileSelection]);

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          resetState();
        }
        onOpenChange(nextOpen);
      },
      [onOpenChange, resetState]
    );

    const applyParseResponse = useCallback((response: IIncomeImportParseResponse) => {
      setFileResults(response.files);
      const rows = response.files.flatMap((file) => file.rows ?? []);
      setPreviewRows(rows);
      setStep("preview");
      notifyIncomeImportParseOutcome(response, rows);
    }, []);

    const parseMutation = useMutation({
      mutationFn: () => parseIncomeCsvFiles(propertyId, selectedFiles),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Smart read failed");
      },
      onSuccess: applyParseResponse,
    });

    const validRowCount = useMemo(
      () => previewRows.filter((row) => !row.validationError).length,
      [previewRows]
    );

    const handleCancel = useCallback(() => {
      handleOpenChange(false);
    }, [handleOpenChange]);

    const handleBackToUpload = useCallback(() => {
      setStep("upload");
    }, []);

    const handleSmartRead = useCallback(() => {
      parseMutation.mutate();
    }, [parseMutation]);

    const footer =
      step === "upload" ? (
        <ImportCsvUploadFooter
          onCancel={handleCancel}
          onSmartRead={handleSmartRead}
          parsePending={parseMutation.isPending}
          selectedFileCount={selectedFiles.length}
        />
      ) : (
        <ImportIncomeCsvPreviewFooter onBack={handleBackToUpload} onCancel={handleCancel} />
      );

    return (
      <ImportCsvDialogShell
        description={`Upload up to ${INCOME_CSV_IMPORT_MAX_FILES} Hotel Tax Calculator CSV files. Tenanto reads stay rows and computes commission and taxes for review.`}
        footer={footer}
        onOpenChange={handleOpenChange}
        open={open}
        title="Import Income from CSV"
      >
        {step === "upload" ? (
          <ImportCsvUploadStep
            isDragOver={isDragOver}
            maxFiles={INCOME_CSV_IMPORT_MAX_FILES}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onFileInputChange={handleFileInputChange}
            onRemoveFile={removeFile}
            selectedFiles={selectedFiles}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {fileResults.map((result) => (
                <IncomeFileResultSummary key={result.fileName} result={result} />
              ))}
            </div>

            {previewRows.length > 0 ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {validRowCount} of {previewRows.length} stay row(s) passed validation.
                </p>
                <ImportIncomeCsvPreviewStep rows={previewRows} />
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                No income rows are ready to import. Remove irrelevant files or upload different
                CSVs.
              </p>
            )}
          </div>
        )}
      </ImportCsvDialogShell>
    );
  }
);
ImportIncomeCsvDialog.displayName = "ImportIncomeCsvDialog";
