import { useMutation, useQuery } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { CsvImportFileResultSummary } from "@/components/csv-import/csv-import-file-result-summary";
import { ImportCsvDialogShell } from "@/components/csv-import/import-csv-dialog-shell";
import { ImportCsvUploadFooter } from "@/components/csv-import/import-csv-upload-footer";
import { ImportCsvUploadStep } from "@/components/csv-import/import-csv-upload-step";
import {
  ImportIncomeCsvPreviewCard,
  ImportIncomeCsvPreviewTableRow,
} from "@/components/income/import-income-csv-preview-fields";
import {
  getImportIncomePreviewRowValidationError,
  IMPORT_INCOME_CSV_PREVIEW_TABLE_CLASS_NAME,
  STICKY_ACTIONS_CELL_CLASS_NAME,
  STICKY_NET_CELL_CLASS_NAME,
} from "@/components/income/import-income-csv-preview-utils";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VirtualizedList } from "@/components/virtualized/virtualized-list";
import { VirtualizedTableBody } from "@/components/virtualized/virtualized-table-body";
import { useCsvFileSelection } from "@/hooks/use-csv-file-selection";
import { useIsDesktop } from "@/hooks/use-media-query";
import { settingsApi, unitsApi } from "@/lib/api-client";
import { parseIncomeCsvFiles } from "@/lib/income-csv-import";
import {
  type IIncomeImportPreviewContext,
  recomputeIncomeImportPreviewRow,
} from "@/lib/income-import-preview-row";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  type IIncomeImportFileResult,
  type IIncomeImportParsedRow,
  type IIncomeImportParseResponse,
  INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE,
  INCOME_CSV_IMPORT_MAX_FILES,
  UnitRentalType,
} from "@/packages/shared";

type TImportStep = "preview" | "upload";

const CSV_IMPORT_LIMITS = {
  maxBytesPerFile: INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE,
  maxFiles: INCOME_CSV_IMPORT_MAX_FILES,
};

const PREVIEW_TABLE_COLUMN_COUNT = 16;
const PREVIEW_CARD_ESTIMATED_HEIGHT = 520;
const PREVIEW_TABLE_ROW_ESTIMATED_HEIGHT = 72;

interface ImportIncomeCsvDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

function createPreviewRowKey(row: IIncomeImportParsedRow, index: number): string {
  return `${row.sourceFileName}-${row.rowIndex}-${index}`;
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

interface ImportIncomeCsvPreviewCardItemProps {
  index: number;
  onRemoveRow: (index: number) => void;
  onUpdateRow: (index: number, nextRow: IIncomeImportParsedRow) => void;
  previewContext: IIncomeImportPreviewContext;
  row: IIncomeImportParsedRow;
}

const ImportIncomeCsvPreviewCardItem = memo(
  ({
    index,
    onRemoveRow,
    onUpdateRow,
    previewContext,
    row,
  }: ImportIncomeCsvPreviewCardItemProps) => {
    const handleChange = useCallback(
      (nextRow: IIncomeImportParsedRow) => {
        onUpdateRow(index, nextRow);
      },
      [index, onUpdateRow]
    );

    const handleRemove = useCallback(() => {
      onRemoveRow(index);
    }, [index, onRemoveRow]);

    return (
      <ImportIncomeCsvPreviewCard
        channelCommissions={previewContext.channels}
        idPrefix={`import-preview-${index}`}
        onChange={handleChange}
        onRemove={handleRemove}
        row={row}
        units={previewContext.units}
      />
    );
  }
);
ImportIncomeCsvPreviewCardItem.displayName = "ImportIncomeCsvPreviewCardItem";

interface ImportIncomeCsvPreviewTableRowItemProps {
  index: number;
  onRemoveRow: (index: number) => void;
  onUpdateRow: (index: number, nextRow: IIncomeImportParsedRow) => void;
  previewContext: IIncomeImportPreviewContext;
  row: IIncomeImportParsedRow;
}

const ImportIncomeCsvPreviewTableRowItem = memo(
  ({
    index,
    onRemoveRow,
    onUpdateRow,
    previewContext,
    row,
  }: ImportIncomeCsvPreviewTableRowItemProps) => {
    const handleChange = useCallback(
      (nextRow: IIncomeImportParsedRow) => {
        onUpdateRow(index, nextRow);
      },
      [index, onUpdateRow]
    );

    const handleRemove = useCallback(() => {
      onRemoveRow(index);
    }, [index, onRemoveRow]);

    return (
      <ImportIncomeCsvPreviewTableRow
        channelCommissions={previewContext.channels}
        idPrefix={`import-preview-${index}`}
        onChange={handleChange}
        onRemove={handleRemove}
        row={row}
        units={previewContext.units}
      />
    );
  }
);
ImportIncomeCsvPreviewTableRowItem.displayName = "ImportIncomeCsvPreviewTableRowItem";

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

export const ImportIncomeCsvDialog = memo(
  ({ onOpenChange, open, propertyId }: ImportIncomeCsvDialogProps) => {
    const [step, setStep] = useState<TImportStep>("upload");
    const [fileResults, setFileResults] = useState<IIncomeImportFileResult[]>([]);
    const [previewRows, setPreviewRows] = useState<IIncomeImportParsedRow[]>([]);
    const [previewScrollElement, setPreviewScrollElement] = useState<HTMLDivElement | null>(null);
    const isDesktop = useIsDesktop();

    const settingsQuery = useQuery({
      enabled: open,
      queryFn: () => settingsApi.get(propertyId),
      queryKey: adminQueryKeys.propertySettings(propertyId),
    });

    const unitsQuery = useQuery({
      enabled: open,
      queryFn: () => unitsApi.list(propertyId),
      queryKey: adminQueryKeys.propertyUnits(propertyId),
    });

    const previewContext = useMemo<IIncomeImportPreviewContext>(
      () => ({
        channels: settingsQuery.data?.settings.channelCommissions ?? [],
        taxRates: settingsQuery.data?.settings.taxRates ?? [],
        units: (unitsQuery.data?.units ?? []).filter(
          (unit) => !unit.isDeleted && unit.rentalType === UnitRentalType.SHORT_TERM
        ),
      }),
      [settingsQuery.data?.settings.channelCommissions, settingsQuery.data?.settings.taxRates, unitsQuery.data?.units]
    );

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
      () => previewRows.filter((row) => getImportIncomePreviewRowValidationError(row) === null).length,
      [previewRows]
    );

    const updatePreviewRow = useCallback(
      (index: number, nextRow: IIncomeImportParsedRow) => {
        setPreviewRows((rows) =>
          rows.map((row, rowIndex) =>
            rowIndex === index ? recomputeIncomeImportPreviewRow(nextRow, previewContext) : row
          )
        );
      },
      [previewContext]
    );

    const removePreviewRow = useCallback((index: number) => {
      setPreviewRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
    }, []);

    const handleCancel = useCallback(() => {
      handleOpenChange(false);
    }, [handleOpenChange]);

    const handleBackToUpload = useCallback(() => {
      setStep("upload");
    }, []);

    const handleSmartRead = useCallback(() => {
      parseMutation.mutate();
    }, [parseMutation]);

    const renderPreviewCard = useCallback(
      (row: IIncomeImportParsedRow, index: number) => (
        <div className="pb-3">
          <ImportIncomeCsvPreviewCardItem
            index={index}
            onRemoveRow={removePreviewRow}
            onUpdateRow={updatePreviewRow}
            previewContext={previewContext}
            row={row}
          />
        </div>
      ),
      [previewContext, removePreviewRow, updatePreviewRow]
    );

    const renderPreviewTableRow = useCallback(
      (row: IIncomeImportParsedRow, index: number) => (
        <ImportIncomeCsvPreviewTableRowItem
          index={index}
          key={createPreviewRowKey(row, index)}
          onRemoveRow={removePreviewRow}
          onUpdateRow={updatePreviewRow}
          previewContext={previewContext}
          row={row}
        />
      ),
      [previewContext, removePreviewRow, updatePreviewRow]
    );

    const previewList = isDesktop ? (
      <div>
        <div className="rounded-lg border overflow-hidden">
          <Table className={IMPORT_INCOME_CSV_PREVIEW_TABLE_CLASS_NAME}>
            <colgroup>
              <col style={{ minWidth: 120, width: 120 }} />
              <col style={{ minWidth: 160, width: 160 }} />
              <col style={{ minWidth: 160, width: 160 }} />
              <col style={{ minWidth: 140, width: 140 }} />
              <col style={{ minWidth: 140, width: 140 }} />
              <col style={{ minWidth: 130, width: 130 }} />
              <col style={{ minWidth: 90, width: 90 }} />
              <col style={{ minWidth: 160, width: 160 }} />
              <col style={{ minWidth: 120, width: 120 }} />
              <col style={{ minWidth: 120, width: 120 }} />
              <col style={{ minWidth: 72, width: 72 }} />
              <col style={{ minWidth: 100, width: 100 }} />
              <col style={{ minWidth: 90, width: 90 }} />
              <col style={{ minWidth: 90, width: 90 }} />
              <col style={{ minWidth: 100, width: 100 }} />
              <col style={{ minWidth: 88, width: 88 }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="whitespace-normal">Guest</TableHead>
                <TableHead className="whitespace-normal">Unit</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="whitespace-normal">Status</TableHead>
                <TableHead>Refund</TableHead>
                <TableHead className="whitespace-normal">Channel</TableHead>
                <TableHead className="text-right">Room total</TableHead>
                <TableHead className="text-right">Cleaning</TableHead>
                <TableHead className="text-right">Nights</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Taxes</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className={cn(STICKY_NET_CELL_CLASS_NAME, "text-right")}>
                  Net
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
          <div ref={setPreviewScrollElement}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                {fileResults.map((result) => (
                  <IncomeFileResultSummary key={result.fileName} result={result} />
                ))}
              </div>

              {previewRows.length > 0 ? (
                <>
                  <p className="text-muted-foreground text-sm">
                    {validRowCount} of {previewRows.length} stay row(s) passed validation. Edit
                    rows before importing in the next phase.
                  </p>
                  {previewList}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No income rows are ready to import. Remove irrelevant files or upload different
                  CSVs.
                </p>
              )}
            </div>
          </div>
        )}
      </ImportCsvDialogShell>
    );
  }
);
ImportIncomeCsvDialog.displayName = "ImportIncomeCsvDialog";
