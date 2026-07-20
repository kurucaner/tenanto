import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { CsvImportFileResultSummary } from "@/components/csv-import/csv-import-file-result-summary";
import { ImportCsvDialogShell } from "@/components/csv-import/import-csv-dialog-shell";
import { ImportCsvUploadFooter } from "@/components/csv-import/import-csv-upload-footer";
import { ImportCsvUploadStep } from "@/components/csv-import/import-csv-upload-step";
import {
  ImportExpenseCsvPreviewCard,
  ImportExpenseCsvPreviewTableRow,
} from "@/components/expenses/import-expense-csv-preview-fields";
import {
  getImportPreviewRowValidationError,
  IMPORT_EXPENSE_CSV_PREVIEW_TABLE_CLASS_NAME,
  STICKY_ACTIONS_CELL_CLASS_NAME,
  STICKY_AMOUNT_CELL_CLASS_NAME,
} from "@/components/expenses/import-expense-csv-preview-utils";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VirtualizedList } from "@/components/virtualized/virtualized-list";
import { VirtualizedTableBody } from "@/components/virtualized/virtualized-table-body";
import { useCsvFileSelection } from "@/hooks/use-csv-file-selection";
import { useIsDesktop } from "@/hooks/use-media-query";
import { expensesApi } from "@/lib/api-client";
import { isLocalEnvironment } from "@/lib/document-title";
import { parseExpenseCsvFiles } from "@/lib/expense-csv-import";
import { loadExpenseImportMockParseResponse } from "@/lib/expense-import-mock-data";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_FILES,
  type IExpenseImportFileResult,
  type IExpenseImportParsedRow,
  type IExpenseImportParseResponse,
  type IPropertyExpenseCategoryType,
} from "@/packages/shared";

type TImportStep = "preview" | "upload";

const CSV_IMPORT_LIMITS = {
  maxBytesPerFile: EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  maxFiles: EXPENSE_CSV_IMPORT_MAX_FILES,
};

const PREVIEW_TABLE_COLUMN_COUNT = 7;
const PREVIEW_CARD_ESTIMATED_HEIGHT = 320;
const PREVIEW_TABLE_ROW_ESTIMATED_HEIGHT = 64;

interface ImportExpenseCsvDialogProps {
  categoryTypes: IPropertyExpenseCategoryType[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

function createPreviewRowKey(row: IExpenseImportParsedRow, index: number): string {
  return `${row.sourceFileName}-${row.rowIndex}-${index}`;
}

interface ImportExpenseCsvPreviewCardItemProps {
  categoryTypes: IPropertyExpenseCategoryType[];
  index: number;
  onRemoveRow: (index: number) => void;
  onUpdateRow: (index: number, nextRow: IExpenseImportParsedRow) => void;
  row: IExpenseImportParsedRow;
}

const ImportExpenseCsvPreviewCardItem = memo(
  ({
    categoryTypes,
    index,
    onRemoveRow,
    onUpdateRow,
    row,
  }: ImportExpenseCsvPreviewCardItemProps) => {
    const handleChange = useCallback(
      (nextRow: IExpenseImportParsedRow) => {
        onUpdateRow(index, nextRow);
      },
      [index, onUpdateRow]
    );

    const handleRemove = useCallback(() => {
      onRemoveRow(index);
    }, [index, onRemoveRow]);

    return (
      <ImportExpenseCsvPreviewCard
        categoryTypes={categoryTypes}
        idPrefix={`import-preview-${index}`}
        onChange={handleChange}
        onRemove={handleRemove}
        row={row}
      />
    );
  }
);
ImportExpenseCsvPreviewCardItem.displayName = "ImportExpenseCsvPreviewCardItem";

interface ImportExpenseCsvPreviewTableRowItemProps {
  categoryTypes: IPropertyExpenseCategoryType[];
  index: number;
  onRemoveRow: (index: number) => void;
  onUpdateRow: (index: number, nextRow: IExpenseImportParsedRow) => void;
  row: IExpenseImportParsedRow;
}

const ImportExpenseCsvPreviewTableRowItem = memo(
  ({
    categoryTypes,
    index,
    onRemoveRow,
    onUpdateRow,
    row,
  }: ImportExpenseCsvPreviewTableRowItemProps) => {
    const handleChange = useCallback(
      (nextRow: IExpenseImportParsedRow) => {
        onUpdateRow(index, nextRow);
      },
      [index, onUpdateRow]
    );

    const handleRemove = useCallback(() => {
      onRemoveRow(index);
    }, [index, onRemoveRow]);

    return (
      <ImportExpenseCsvPreviewTableRow
        categoryTypes={categoryTypes}
        idPrefix={`import-preview-${index}`}
        onChange={handleChange}
        onRemove={handleRemove}
        row={row}
      />
    );
  }
);
ImportExpenseCsvPreviewTableRowItem.displayName = "ImportExpenseCsvPreviewTableRowItem";

function notifyExpenseImportParseOutcome(
  response: IExpenseImportParseResponse,
  rows: IExpenseImportParsedRow[]
): void {
  const irrelevantCount = response.files.filter((file) => file.status === "irrelevant").length;
  const errorCount = response.files.filter((file) => file.status === "error").length;

  if (rows.length === 0) {
    toast.info("No importable expense rows were found.");
    return;
  }

  if (irrelevantCount > 0 || errorCount > 0) {
    toast.message("Some files could not be imported", {
      description: `${rows.length} row(s) ready for review.`,
    });
  }
}

interface ImportExpenseCsvPreviewFooterProps {
  commitPending: boolean;
  hasBlockingValidationErrors: boolean;
  onBack: () => void;
  onCancel: () => void;
  onCommitImport: () => void;
  validRowCount: number;
}

const ImportExpenseCsvPreviewFooter = memo(
  ({
    commitPending,
    hasBlockingValidationErrors,
    onBack,
    onCancel,
    onCommitImport,
    validRowCount,
  }: ImportExpenseCsvPreviewFooterProps) => (
    <DialogFooter>
      <Button disabled={commitPending} onClick={onCancel} type="button" variant="outline">
        Cancel
      </Button>
      <Button disabled={commitPending} onClick={onBack} type="button" variant="outline">
        Back
      </Button>
      <Button
        disabled={validRowCount === 0 || hasBlockingValidationErrors || commitPending}
        onClick={onCommitImport}
        type="button"
      >
        {commitPending ? "Importing…" : `Import ${validRowCount} expense(s)`}
      </Button>
    </DialogFooter>
  )
);
ImportExpenseCsvPreviewFooter.displayName = "ImportExpenseCsvPreviewFooter";

const ExpenseFileResultSummary = memo(({ result }: { result: IExpenseImportFileResult }) => {
  const rowCount = result.status === "parsed" ? (result.rows?.length ?? 0) : null;

  return (
    <CsvImportFileResultSummary
      fileName={result.fileName}
      message={result.message}
      rowCount={rowCount}
      rowCountLabel="expense row(s)"
      status={result.status}
    />
  );
});
ExpenseFileResultSummary.displayName = "ExpenseFileResultSummary";

export const ImportExpenseCsvDialog = memo(
  ({ categoryTypes, onOpenChange, open, propertyId }: ImportExpenseCsvDialogProps) => {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<TImportStep>("upload");
    const [fileResults, setFileResults] = useState<IExpenseImportFileResult[]>([]);
    const [previewRows, setPreviewRows] = useState<IExpenseImportParsedRow[]>([]);
    const [isLoadingMock, setIsLoadingMock] = useState(false);
    const [previewScrollElement, setPreviewScrollElement] = useState<HTMLDivElement | null>(null);
    const isDesktop = useIsDesktop();
    const showMockDataButton = isLocalEnvironment();

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
      setIsLoadingMock(false);
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

    const applyParseResponse = useCallback((response: IExpenseImportParseResponse) => {
      setFileResults(response.files);
      const rows = response.files.flatMap((file) => file.rows ?? []);
      setPreviewRows(rows);
      setStep("preview");
      notifyExpenseImportParseOutcome(response, rows);
    }, []);

    const parseMutation = useMutation({
      mutationFn: () => parseExpenseCsvFiles(propertyId, selectedFiles),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Smart read failed");
      },
      onSuccess: applyParseResponse,
    });

    const handleGenerateMockData = useCallback(async () => {
      if (!showMockDataButton) {
        return;
      }

      setIsLoadingMock(true);
      try {
        const response = await loadExpenseImportMockParseResponse(categoryTypes);
        const rowCount = response.files.flatMap((file) => file.rows ?? []).length;
        applyParseResponse(response);
        toast.success(`Loaded ${rowCount} mock expense row(s)`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load mock data");
      } finally {
        setIsLoadingMock(false);
      }
    }, [applyParseResponse, categoryTypes, showMockDataButton]);

    const commitMutation = useMutation({
      mutationFn: (rows: IExpenseImportParsedRow[]) =>
        expensesApi.importCommit(propertyId, { rows }),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to import expenses");
      },
      onSuccess: (response) => {
        toast.success(`Imported ${response.createdCount} expense(s)`);
        invalidatePropertyExpenseCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const validRowCount = useMemo(
      () => previewRows.filter((row) => getImportPreviewRowValidationError(row) === null).length,
      [previewRows]
    );

    const importablePreviewRows = useMemo(
      () => previewRows.filter((row) => getImportPreviewRowValidationError(row) === null),
      [previewRows]
    );

    const hasBlockingValidationErrors = previewRows.some(
      (row) => getImportPreviewRowValidationError(row) !== null
    );

    const updatePreviewRow = useCallback((index: number, nextRow: IExpenseImportParsedRow) => {
      setPreviewRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? nextRow : row)));
    }, []);

    const removePreviewRow = useCallback((index: number) => {
      setPreviewRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
    }, []);

    const handleCommitImport = useCallback(() => {
      commitMutation.mutate(importablePreviewRows);
    }, [commitMutation, importablePreviewRows]);

    const handleCancel = useCallback(() => {
      handleOpenChange(false);
    }, [handleOpenChange]);

    const handleBackToUpload = useCallback(() => {
      setStep("upload");
    }, []);

    const handleSmartRead = useCallback(() => {
      parseMutation.mutate();
    }, [parseMutation]);

    const handleGenerateMockDataClick = useCallback(() => {
      void handleGenerateMockData();
    }, [handleGenerateMockData]);

    const renderPreviewCard = useCallback(
      (row: IExpenseImportParsedRow, index: number) => (
        <div className="pb-3">
          <ImportExpenseCsvPreviewCardItem
            categoryTypes={categoryTypes}
            index={index}
            onRemoveRow={removePreviewRow}
            onUpdateRow={updatePreviewRow}
            row={row}
          />
        </div>
      ),
      [categoryTypes, removePreviewRow, updatePreviewRow]
    );

    const renderPreviewTableRow = useCallback(
      (row: IExpenseImportParsedRow, index: number) => (
        <ImportExpenseCsvPreviewTableRowItem
          categoryTypes={categoryTypes}
          index={index}
          key={createPreviewRowKey(row, index)}
          onRemoveRow={removePreviewRow}
          onUpdateRow={updatePreviewRow}
          row={row}
        />
      ),
      [categoryTypes, removePreviewRow, updatePreviewRow]
    );

    const previewList = isDesktop ? (
      <div>
        <div className="rounded-lg border overflow-hidden">
          <Table className={IMPORT_EXPENSE_CSV_PREVIEW_TABLE_CLASS_NAME}>
            <colgroup>
              <col style={{ minWidth: 120, width: 120 }} />
              <col style={{ minWidth: 180, width: 180 }} />
              <col style={{ minWidth: 140, width: 140 }} />
              <col style={{ minWidth: 160, width: 160 }} />
              <col style={{ minWidth: 90, width: 90 }} />
              <col style={{ minWidth: 120, width: 120 }} />
              <col style={{ minWidth: 88, width: 88 }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="whitespace-normal">Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="whitespace-normal">Description</TableHead>
                <TableHead>Cash</TableHead>
                <TableHead className={cn(STICKY_AMOUNT_CELL_CLASS_NAME, "text-right")}>
                  Amount
                </TableHead>
                <TableHead className={STICKY_ACTIONS_CELL_CLASS_NAME}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <VirtualizedTableBody
              colSpan={PREVIEW_TABLE_COLUMN_COUNT}
              estimateRowHeight={PREVIEW_TABLE_ROW_ESTIMATED_HEIGHT}
              getItemKey={createPreviewRowKey}
              items={previewRows}
              renderRow={renderPreviewTableRow}
              scrollElement={previewScrollElement}
            />
          </Table>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Scroll horizontally to see all columns.
        </p>
      </div>
    ) : (
      <VirtualizedList
        estimateItemHeight={PREVIEW_CARD_ESTIMATED_HEIGHT}
        getItemKey={createPreviewRowKey}
        items={previewRows}
        renderItem={renderPreviewCard}
        scrollElement={previewScrollElement}
      />
    );

    const footer =
      step === "upload" ? (
        <ImportCsvUploadFooter
          isLoadingMock={isLoadingMock}
          onCancel={handleCancel}
          onGenerateMockData={handleGenerateMockDataClick}
          onSmartRead={handleSmartRead}
          parsePending={parseMutation.isPending}
          selectedFileCount={selectedFiles.length}
          showMockDataButton={showMockDataButton}
        />
      ) : (
        <ImportExpenseCsvPreviewFooter
          commitPending={commitMutation.isPending}
          hasBlockingValidationErrors={hasBlockingValidationErrors}
          onBack={handleBackToUpload}
          onCancel={handleCancel}
          onCommitImport={handleCommitImport}
          validRowCount={validRowCount}
        />
      );

    return (
      <ImportCsvDialogShell
        description={`Upload up to ${EXPENSE_CSV_IMPORT_MAX_FILES} CSV files. AI reads transactions and suggests categories — review before saving.`}
        footer={footer}
        onBodyElementReady={setPreviewScrollElement}
        onOpenChange={handleOpenChange}
        open={open}
        title="Import Expenses from CSV"
      >
        {step === "upload" ? (
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
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {fileResults.map((result) => (
                <ExpenseFileResultSummary key={result.fileName} result={result} />
              ))}
            </div>

            {previewRows.length > 0 ? (
              previewList
            ) : (
              <p className="text-muted-foreground text-sm">
                No expense rows are ready to import. Remove irrelevant files or upload different
                CSVs.
              </p>
            )}
          </div>
        )}
      </ImportCsvDialogShell>
    );
  }
);
ImportExpenseCsvDialog.displayName = "ImportExpenseCsvDialog";
