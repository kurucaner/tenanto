import { useMutation } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { memo, type ReactNode, type RefObject, useCallback } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import {
  type DataTableColumn,
  type DataTableSortController,
} from "@/components/data-table/data-table-types";
import { ExportJobStatusBadge } from "@/components/exports/export-job-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { downloadExportFile } from "@/lib/download-export-file";
import {
  formatExportJobDate,
  formatExportJobFilterSummary,
  getExportFormatLabel,
  getExportResourceTypeLabel,
  type IExportFilterSummaryOptions,
  isExportJobDownloadable,
} from "@/lib/property-export-utils";
import { cn } from "@/lib/utils";
import { ExportJobStatus, type IExportJob } from "@/packages/shared";

const EXPORT_COLUMNS: DataTableColumn[] = [
  { id: "requestedAt", label: "Requested", sortable: true },
  { id: "resourceType", label: "Resource", sortable: true },
  { id: "format", label: "Format", sortable: true },
  { id: "filters", label: "Filters" },
  { id: "status", label: "Status", sortable: true },
  { id: "rowCount", label: "Rows", sortable: true },
  { id: "actions", label: "Actions" },
];

const EXPORT_ROW_ESTIMATED_HEIGHT = 56;

function getExportJobKey(job: IExportJob): string {
  return job.id;
}

const ExportJobActions = memo(
  ({
    isDownloading,
    job,
    onDownload,
  }: {
    isDownloading: boolean;
    job: IExportJob;
    onDownload: (jobId: string) => void;
  }) => {
    if (isExportJobDownloadable(job.status)) {
      return (
        <Button
          className="gap-1.5"
          disabled={isDownloading}
          onClick={() => onDownload(job.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Download
        </Button>
      );
    }

    if (job.status === ExportJobStatus.FAILED) {
      return (
        <p className="text-destructive max-w-[220px] text-xs">
          {job.errorMessage ?? "Export failed"}
        </p>
      );
    }

    if (job.status === ExportJobStatus.EXPIRED) {
      return (
        <p className="text-muted-foreground text-xs">File expired — export again to download</p>
      );
    }

    return <p className="text-muted-foreground text-xs">Preparing your file…</p>;
  }
);
ExportJobActions.displayName = "ExportJobActions";

const ExportJobRow = memo(
  ({
    filterSummaryOptions,
    highlighted,
    isDownloading,
    job,
    onDownload,
  }: {
    filterSummaryOptions: IExportFilterSummaryOptions;
    highlighted: boolean;
    isDownloading: boolean;
    job: IExportJob;
    onDownload: (jobId: string) => void;
  }) => (
    <TableRow
      className={cn(
        highlighted && "bg-primary/10 ring-primary/40 ring-2 ring-inset transition-colors"
      )}
      id={`export-job-${job.id}`}
    >
      <TableCell className="text-muted-foreground text-sm">
        {formatExportJobDate(job.createdAt)}
      </TableCell>
      <TableCell>{getExportResourceTypeLabel(job.resourceType)}</TableCell>
      <TableCell>{getExportFormatLabel(job.format)}</TableCell>
      <TableCell className="max-w-[240px] truncate text-sm">
        {formatExportJobFilterSummary(job, filterSummaryOptions)}
      </TableCell>
      <TableCell>
        <ExportJobStatusBadge status={job.status} />
      </TableCell>
      <TableCell>{job.rowCount ?? "—"}</TableCell>
      <TableCell>
        <ExportJobActions isDownloading={isDownloading} job={job} onDownload={onDownload} />
      </TableCell>
    </TableRow>
  )
);
ExportJobRow.displayName = "ExportJobRow";

interface IPropertyExportsTableProps {
  exports: IExportJob[];
  filterSummaryOptions: IExportFilterSummaryOptions;
  hasNextPage: boolean;
  highlightJobId: string | null;
  isFetchingNextPage: boolean;
  isPending: boolean;
  propertyId: string;
  scrollSentinelRef: RefObject<HTMLDivElement | null>;
  sort: DataTableSortController;
  toolbar: ReactNode;
}

export const PropertyExportsTable = memo(
  ({
    exports,
    filterSummaryOptions,
    hasNextPage,
    highlightJobId,
    isFetchingNextPage,
    isPending,
    propertyId,
    scrollSentinelRef,
    sort,
    toolbar,
  }: IPropertyExportsTableProps) => {
    const downloadMutation = useMutation({
      mutationFn: (jobId: string) => downloadExportFile(propertyId, jobId),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to download export");
      },
    });

    const handleDownload = useCallback(
      (jobId: string) => {
        downloadMutation.mutate(jobId);
      },
      [downloadMutation]
    );

    const renderExportRow = useCallback(
      (job: IExportJob) => (
        <ExportJobRow
          filterSummaryOptions={filterSummaryOptions}
          highlighted={highlightJobId === job.id}
          isDownloading={downloadMutation.isPending && downloadMutation.variables === job.id}
          job={job}
          key={job.id}
          onDownload={handleDownload}
        />
      ),
      [
        downloadMutation.isPending,
        downloadMutation.variables,
        filterSummaryOptions,
        handleDownload,
        highlightJobId,
      ]
    );

    const toolbarNode = toolbar;

    return (
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <DataTable
            columns={EXPORT_COLUMNS}
            emptyMessage="No exports yet. Queue one from Expenses, Income, or Leases using Export table."
            getItemKey={getExportJobKey}
            infiniteScroll={{ hasNextPage, isFetchingNextPage }}
            infiniteScrollSentinelRef={scrollSentinelRef}
            isPending={isPending}
            items={exports}
            renderRow={renderExportRow}
            sort={sort}
            toolbar={toolbarNode}
            virtualization={{ estimateRowHeight: EXPORT_ROW_ESTIMATED_HEIGHT }}
          />
        </CardContent>
      </Card>
    );
  }
);
PropertyExportsTable.displayName = "PropertyExportsTable";
