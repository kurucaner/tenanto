import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { type DragEvent, memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  EXPENSE_CATEGORY_OPTIONS,
  expenseSelectClassName,
} from "@/components/expenses/expense-form-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { expensesApi } from "@/lib/api-client";
import {
  formatExpenseCsvRejections,
  type ISelectedExpenseCsvFile,
  parseExpenseCsvFiles,
  processExpenseCsvIncomingFiles,
} from "@/lib/expense-csv-import";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CSV_IMPORT_MAX_FILES,
  getExpenseCategoryMeta,
  type IExpenseImportFileResult,
  type IExpenseImportParsedRow,
  validateExpenseCategoryFields,
} from "@/packages/shared";

type TImportStep = "preview" | "upload";

interface ImportExpenseCsvDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

function getRowValidationError(row: IExpenseImportParsedRow): string | null {
  if (row.validationError) {
    return row.validationError;
  }

  const categoryError = validateExpenseCategoryFields(row.category, {
    description: row.description,
  });
  if (categoryError) {
    return categoryError;
  }

  if (!Number.isFinite(row.amount) || row.amount < 0) {
    return "Amount must be a non-negative number";
  }

  return null;
}

function createPreviewRowKey(row: IExpenseImportParsedRow, index: number): string {
  return `${row.sourceFileName}-${row.rowIndex}-${index}`;
}

const FileResultSummary = memo(({ result }: { result: IExpenseImportFileResult }) => {
  const toneClassName =
    result.status === "parsed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : result.status === "irrelevant"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-destructive/30 bg-destructive/5 text-destructive";

  const title =
    result.status === "parsed"
      ? `${result.fileName} — ${result.rows?.length ?? 0} expense row(s) found`
      : result.fileName;

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", toneClassName)}>
      <p className="font-medium">{title}</p>
      {result.message ? <p className="mt-1 text-xs opacity-90">{result.message}</p> : null}
    </div>
  );
});
FileResultSummary.displayName = "FileResultSummary";

const PreviewRow = memo(
  ({
    onChange,
    onRemove,
    row,
  }: {
    onChange: (next: IExpenseImportParsedRow) => void;
    onRemove: () => void;
    row: IExpenseImportParsedRow;
  }) => {
    const validationError = getRowValidationError(row);
    const meta = getExpenseCategoryMeta(row.category);

    return (
      <TableRow>
        <TableCell className="max-w-[120px] truncate text-xs">{row.sourceFileName}</TableCell>
        <TableCell>
          <select
            className={expenseSelectClassName}
            onChange={(e) => onChange({ ...row, category: e.target.value as IExpenseImportParsedRow["category"] })}
            value={row.category}
          >
            {EXPENSE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </TableCell>
        <TableCell>
          <Input
            onChange={(e) => onChange({ ...row, expenseDate: e.target.value })}
            type="date"
            value={row.expenseDate ?? ""}
          />
        </TableCell>
        <TableCell>
          <Input
            onChange={(e) => onChange({ ...row, personName: e.target.value })}
            value={row.personName ?? ""}
          />
        </TableCell>
        <TableCell>
          <Input
            onChange={(e) => onChange({ ...row, description: e.target.value })}
            value={row.description ?? ""}
          />
        </TableCell>
        <TableCell>
          <label className="flex items-center gap-2 text-xs">
            <input
              checked={row.taxFree ?? false}
              onChange={(e) => onChange({ ...row, taxFree: e.target.checked })}
              type="checkbox"
            />
            Tax-free
          </label>
        </TableCell>
        <TableCell>
          <Input
            onChange={(e) => onChange({ ...row, amount: Number(e.target.value) || 0 })}
            step="0.01"
            type="number"
            value={row.amount}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {validationError ? (
              <Badge title={validationError} variant="destructive">
                <AlertCircle className="size-3" />
              </Badge>
            ) : null}
            {meta.requiresDescription && !row.description?.trim() ? (
              <Badge variant="secondary">Needs description</Badge>
            ) : null}
            <Button aria-label="Remove row" onClick={onRemove} size="icon-sm" type="button" variant="ghost">
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }
);
PreviewRow.displayName = "PreviewRow";

export const ImportExpenseCsvDialog = memo(
  ({ onOpenChange, open, propertyId }: ImportExpenseCsvDialogProps) => {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<TImportStep>("upload");
    const [selectedFiles, setSelectedFiles] = useState<ISelectedExpenseCsvFile[]>([]);
    const [fileResults, setFileResults] = useState<IExpenseImportFileResult[]>([]);
    const [previewRows, setPreviewRows] = useState<IExpenseImportParsedRow[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);

    const resetState = useCallback(() => {
      setStep("upload");
      setSelectedFiles([]);
      setFileResults([]);
      setPreviewRows([]);
      setIsDragOver(false);
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
      setSelectedFiles((current) => {
        const { files, rejections } = processExpenseCsvIncomingFiles(current, incoming);
        const message = formatExpenseCsvRejections(rejections);
        if (message) {
          toast.error(message);
        }
        return files;
      });
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

    const parseMutation = useMutation({
      mutationFn: () => parseExpenseCsvFiles(propertyId, selectedFiles),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to parse CSV files");
      },
      onSuccess: (response) => {
        setFileResults(response.files);
        const rows = response.files.flatMap((file) => file.rows ?? []);
        setPreviewRows(rows);
        setStep("preview");

        const irrelevantCount = response.files.filter((file) => file.status === "irrelevant").length;
        const errorCount = response.files.filter((file) => file.status === "error").length;
        if (rows.length === 0) {
          toast.info("No importable expense rows were found.");
        } else if (irrelevantCount > 0 || errorCount > 0) {
          toast.message("Some files could not be imported", {
            description: `${rows.length} row(s) ready for review.`,
          });
        }
      },
    });

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
      () => previewRows.filter((row) => getRowValidationError(row) === null).length,
      [previewRows]
    );

    const hasBlockingValidationErrors = previewRows.some(
      (row) => getRowValidationError(row) !== null
    );

    const updatePreviewRow = useCallback((index: number, nextRow: IExpenseImportParsedRow) => {
      setPreviewRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? nextRow : row)));
    }, []);

    const removePreviewRow = useCallback((index: number) => {
      setPreviewRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
    }, []);

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[1100px]">
          <DialogHeader>
            <DialogTitle>Import Expenses from CSV</DialogTitle>
            <DialogDescription>
              Upload up to {EXPENSE_CSV_IMPORT_MAX_FILES} CSV files. Review parsed rows before saving.
            </DialogDescription>
          </DialogHeader>

          {step === "upload" ? (
            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
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
                    onChange={(e) => {
                      if (e.target.files) {
                        addFiles(e.target.files);
                      }
                      e.target.value = "";
                    }}
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
                    <li
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                      key={entry.id}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <FileSpreadsheet className="text-muted-foreground size-4" />
                        <span>{entry.file.name}</span>
                      </div>
                      <Button
                        aria-label={`Remove ${entry.file.name}`}
                        onClick={() =>
                          setSelectedFiles((files) => files.filter((file) => file.id !== entry.id))
                        }
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-2">
                {fileResults.map((result) => (
                  <FileResultSummary key={result.fileName} result={result} />
                ))}
              </div>

              {previewRows.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Person</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Tax</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, index) => (
                        <PreviewRow
                          key={createPreviewRowKey(row, index)}
                          onChange={(nextRow) => updatePreviewRow(index, nextRow)}
                          onRemove={() => removePreviewRow(index)}
                          row={row}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No expense rows are ready to import. Remove irrelevant files or upload different CSVs.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={parseMutation.isPending || commitMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            {step === "upload" ? (
              <Button
                disabled={selectedFiles.length === 0 || parseMutation.isPending}
                onClick={() => parseMutation.mutate()}
                type="button"
              >
                {parseMutation.isPending ? "Parsing…" : "Parse files"}
              </Button>
            ) : (
              <>
                <Button
                  disabled={parseMutation.isPending || commitMutation.isPending}
                  onClick={() => setStep("upload")}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  disabled={
                    validRowCount === 0 || hasBlockingValidationErrors || commitMutation.isPending
                  }
                  onClick={() =>
                    commitMutation.mutate(
                      previewRows.filter((row) => getRowValidationError(row) === null)
                    )
                  }
                  type="button"
                >
                  {commitMutation.isPending ? "Importing…" : `Import ${validRowCount} expense(s)`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
ImportExpenseCsvDialog.displayName = "ImportExpenseCsvDialog";
