import { memo } from "react";

import { cn } from "@/lib/utils";

export type TCsvImportFileResultStatus = "error" | "irrelevant" | "parsed";

const FILE_RESULT_TONE_CLASS_NAMES: Record<TCsvImportFileResultStatus, string> = {
  error: "border-destructive/30 bg-destructive/5 text-destructive",
  irrelevant:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
  parsed:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
};

interface CsvImportFileResultSummaryProps {
  fileName: string;
  message?: string | null;
  rowCount?: number | null;
  rowCountLabel?: string;
  status: TCsvImportFileResultStatus;
}

export const CsvImportFileResultSummary = memo(
  ({ fileName, message, rowCount, rowCountLabel, status }: CsvImportFileResultSummaryProps) => {
    const toneClassName = FILE_RESULT_TONE_CLASS_NAMES[status];

    return (
      <div className={cn("min-w-0 rounded-lg border px-3 py-2 text-sm", toneClassName)}>
        <div className="flex min-w-0 items-baseline gap-x-1">
          <p className="min-w-0 truncate font-medium" title={fileName}>
            {fileName}
          </p>
          {rowCount !== null && rowCount !== undefined && rowCountLabel ? (
            <p className="shrink-0 font-medium whitespace-nowrap">
              — {rowCount} {rowCountLabel}
            </p>
          ) : null}
        </div>
        {message ? <p className="mt-1 text-xs opacity-90">{message}</p> : null}
      </div>
    );
  }
);
CsvImportFileResultSummary.displayName = "CsvImportFileResultSummary";
