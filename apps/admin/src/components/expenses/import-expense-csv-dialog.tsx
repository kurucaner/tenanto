import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Sparkles, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VirtualizedList } from "@/components/virtualized/virtualized-list";
import { VirtualizedTableBody } from "@/components/virtualized/virtualized-table-body";
import { useIsDesktop } from "@/hooks/use-media-query";
import { expensesApi } from "@/lib/api-client";
import { isLocalEnvironment } from "@/lib/document-title";
import {
  formatExpenseCsvRejections,
  type ISelectedExpenseCsvFile,
  parseExpenseCsvFiles,
  processExpenseCsvIncomingFiles,
} from "@/lib/expense-csv-import";
import { loadExpenseImportMockParseResponse } from "@/lib/expense-import-mock-data";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CSV_IMPORT_MAX_FILES,
  type IExpenseImportFileResult,
  type IExpenseImportParsedRow,
  type IExpenseImportParseResponse,
  type IPropertyExpenseCategoryType,
  type TExpenseImportFileStatus,
} from "@/packages/shared";

type TImportStep = "preview" | "upload";

const PREVIEW_TABLE_COLUMN_COUNT = 7;
const PREVIEW_CARD_ESTIMATED_HEIGHT = 320;
const PREVIEW_TABLE_ROW_ESTIMATED_HEIGHT = 64;

const FILE_RESULT_TONE_CLASS_NAMES: Record<TExpenseImportFileStatus, string> = {
  error: "border-destructive/30 bg-destructive/5 text-destructive",
  irrelevant:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
  parsed:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
};

function getFileResultToneClassName(status: TExpenseImportFileStatus): string {
  return FILE_RESULT_TONE_CLASS_NAMES[status];
}

interface ImportExpenseCsvDialogProps {
  categoryTypes: IPropertyExpenseCategoryType[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

function createPreviewRowKey(row: IExpenseImportParsedRow, index: number): string {
  return `${row.sourceFileName}-${row.rowIndex}-${index}`;
}

const FileResultSummary = memo(({ result }: { result: IExpenseImportFileResult }) => {
  const toneClassName = getFileResultToneClassName(result.status);
  const rowCount = result.status === "parsed" ? (result.rows?.length ?? 0) : null;

  return (
    <div className={cn("min-w-0 rounded-lg border px-3 py-2 text-sm", toneClassName)}>
      <div className="flex min-w-0 items-baseline gap-x-1">
        <p className="min-w-0 truncate font-medium" title={result.fileName}>
          {result.fileName}
        </p>
        {rowCount !== null ? (
          <p className="shrink-0 font-medium whitespace-nowrap">— {rowCount} expense row(s)</p>
        ) : null}
      </div>
      {result.message ? <p className="mt-1 text-xs opacity-90">{result.message}</p> : null}
    </div>
  );
});
FileResultSummary.displayName = "FileResultSummary";

interface SelectedExpenseCsvFileItemProps {
  entry: ISelectedExpenseCsvFile;
  onRemove: (fileId: string) => void;
}

const SelectedExpenseCsvFileItem = memo(({ entry, onRemove }: SelectedExpenseCsvFileItemProps) => {
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
SelectedExpenseCsvFileItem.displayName = "SelectedExpenseCsvFileItem";

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

interface ImportExpenseCsvDialogFooterProps {
  commitPending: boolean;
  hasBlockingValidationErrors: boolean;
  isLoadingMock: boolean;
  onBack: () => void;
  onCancel: () => void;
  onCommitImport: () => void;
  onGenerateMockData: () => void;
  onSmartRead: () => void;
  parsePending: boolean;
  selectedFileCount: number;
  showMockDataButton: boolean;
  step: TImportStep;
  validRowCount: number;
}

const ImportExpenseCsvDialogFooter = memo(
  ({
    commitPending,
    hasBlockingValidationErrors,
    isLoadingMock,
    onBack,
    onCancel,
    onCommitImport,
    onGenerateMockData,
    onSmartRead,
    parsePending,
    selectedFileCount,
    showMockDataButton,
    step,
    validRowCount,
  }: ImportExpenseCsvDialogFooterProps) => {
    const actionsPending = parsePending || commitPending;

    return (
      <DialogFooter>
        <Button disabled={actionsPending} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        {step === "upload" ? (
          <>
            {showMockDataButton ? (
              <Button
                disabled={isLoadingMock || parsePending}
                onClick={onGenerateMockData}
                type="button"
                variant="secondary"
              >
                {isLoadingMock ? "Generating…" : "Generate mock data"}
              </Button>
            ) : null}
            <Button
              className="gap-1.5"
              disabled={selectedFileCount === 0 || parsePending || isLoadingMock}
              onClick={onSmartRead}
              type="button"
            >
              <Sparkles className="size-3.5" />
              {parsePending ? "Smart reading…" : "Smart read"}
            </Button>
          </>
        ) : (
          <>
            <Button disabled={actionsPending} onClick={onBack} type="button" variant="outline">
              Back
            </Button>
            <Button
              disabled={validRowCount === 0 || hasBlockingValidationErrors || commitPending}
              onClick={onCommitImport}
              type="button"
            >
              {commitPending ? "Importing…" : `Import ${validRowCount} expense(s)`}
            </Button>
          </>
        )}
      </DialogFooter>
    );
  }
);
ImportExpenseCsvDialogFooter.displayName = "ImportExpenseCsvDialogFooter";

export const ImportExpenseCsvDialog = memo(
  ({ categoryTypes, onOpenChange, open, propertyId }: ImportExpenseCsvDialogProps) => {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<TImportStep>("upload");
    const [selectedFiles, setSelectedFiles] = useState<ISelectedExpenseCsvFile[]>([]);
    const [fileResults, setFileResults] = useState<IExpenseImportFileResult[]>([]);
    const [previewRows, setPreviewRows] = useState<IExpenseImportParsedRow[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isLoadingMock, setIsLoadingMock] = useState(false);
    // Held in state (callback ref) so its attachment re-renders the
    // virtualizers, which mount in the same commit as this element.
    const [previewScrollElement, setPreviewScrollElement] = useState<HTMLDivElement | null>(null);
    const isDesktop = useIsDesktop();
    const showMockDataButton = isLocalEnvironment();

    const resetState = useCallback(() => {
      setStep("upload");
      setSelectedFiles([]);
      setFileResults([]);
      setPreviewRows([]);
      setIsDragOver(false);
      setIsLoadingMock(false);
    }, []);

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          resetState();
        }
        onOpenChange(nextOpen);
      },
      [onOpenChange, resetState]
    );

    const addFiles = useCallback((incoming: FileList | File[]) => {
      const picked = Array.from(incoming);
      if (picked.length === 0) {
        return;
      }

      setSelectedFiles((current) => {
        const { files, rejections } = processExpenseCsvIncomingFiles(current, picked);
        const message = formatExpenseCsvRejections(rejections);
        if (message) {
          toast.error(message);
        }
        return files;
      });
    }, []);

    const handleFileInputChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
          addFiles(event.target.files);
        }
        event.target.value = "";
      },
      [addFiles]
    );

    const removeSelectedFile = useCallback((fileId: string) => {
      setSelectedFiles((files) => files.filter((file) => file.id !== fileId));
    }, []);

    const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
      (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setIsDragOver(false);
        if (event.dataTransfer.files.length > 0) {
          addFiles(event.dataTransfer.files);
        }
      },
      [addFiles]
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
                <TableHead>Tax</TableHead>
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

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col sm:max-w-[min(1100px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Import Expenses from CSV</DialogTitle>
            <DialogDescription>
              Upload up to {EXPENSE_CSV_IMPORT_MAX_FILES} CSV files. AI reads transactions and
              suggests categories — review before saving.
            </DialogDescription>
          </DialogHeader>

          {step === "upload" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-4">
                <div
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8",
                    isDragOver && "border-ring bg-muted/30"
                  )}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <Upload className="text-muted-foreground size-5" />
                  <p className="text-muted-foreground text-sm">
                    Drag CSV files here or choose files below.
                  </p>
                  <Label className="cursor-pointer">
                    <span className="text-primary text-sm font-medium">Choose CSV files</span>
                    <input
                      accept=".csv,text/csv"
                      className="sr-only"
                      multiple
                      onChange={handleFileInputChange}
                      type="file"
                    />
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    CSV only · up to {EXPENSE_CSV_IMPORT_MAX_FILES} files · 1 MB each
                  </p>
                </div>

                {selectedFiles.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {selectedFiles.map((entry) => (
                      <SelectedExpenseCsvFileItem
                        entry={entry}
                        key={entry.id}
                        onRemove={removeSelectedFile}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5" ref={setPreviewScrollElement}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  {fileResults.map((result) => (
                    <FileResultSummary key={result.fileName} result={result} />
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
            </div>
          )}

          <ImportExpenseCsvDialogFooter
            commitPending={commitMutation.isPending}
            hasBlockingValidationErrors={hasBlockingValidationErrors}
            isLoadingMock={isLoadingMock}
            onBack={handleBackToUpload}
            onCancel={handleCancel}
            onCommitImport={handleCommitImport}
            onGenerateMockData={handleGenerateMockDataClick}
            onSmartRead={handleSmartRead}
            parsePending={parseMutation.isPending}
            selectedFileCount={selectedFiles.length}
            showMockDataButton={showMockDataButton}
            step={step}
            validRowCount={validRowCount}
          />
        </DialogContent>
      </Dialog>
    );
  }
);
ImportExpenseCsvDialog.displayName = "ImportExpenseCsvDialog";
