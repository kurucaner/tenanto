import { type TSelectOption } from "@/lib/select-option-types";
import {
  ExportFormat,
  ExportJobStatus,
  ExportResourceType,
  type IExportJob,
  type TExportFormat,
  type TExportJobStatus,
  type TExportResourceType,
  type TPropertyExpensesListFilters,
} from "@/packages/shared";

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatExpenseExportFilterSummary(
  filters: TPropertyExpensesListFilters,
  categoryOptions: readonly TSelectOption[] = []
): string {
  const parts: string[] = [];

  if (filters.from != null || filters.to != null) {
    parts.push(`${filters.from ?? "…"} – ${filters.to ?? "…"}`);
  }

  if (filters.categoryId != null && filters.categoryId !== "") {
    parts.push(`Category: ${findOptionLabel(categoryOptions, filters.categoryId)}`);
  }

  const qTrim = filters.q?.trim();
  if (qTrim != null && qTrim !== "") {
    parts.push(`Search: ${qTrim}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "All expenses";
}

export function getExportResourceTypeLabel(resourceType: TExportResourceType): string {
  if (resourceType === ExportResourceType.EXPENSES) {
    return "Expenses";
  }
  return resourceType;
}

export function getExportFormatLabel(format: TExportFormat): string {
  if (format === ExportFormat.CSV) {
    return "CSV";
  }
  if (format === ExportFormat.XLSX) {
    return "Excel";
  }
  return format;
}

export function getExportJobStatusLabel(status: TExportJobStatus): string {
  switch (status) {
    case ExportJobStatus.COMPLETED:
      return "Completed";
    case ExportJobStatus.EXPIRED:
      return "Expired";
    case ExportJobStatus.FAILED:
      return "Failed";
    case ExportJobStatus.PENDING:
      return "Queued";
    case ExportJobStatus.PROCESSING:
      return "Processing";
    default:
      return status;
  }
}

export function isExportJobDownloadable(status: TExportJobStatus): boolean {
  return status === ExportJobStatus.COMPLETED;
}

export function formatExportJobDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatExportJobFilterSummary(
  job: Pick<IExportJob, "filters" | "resourceType">,
  categoryOptions: readonly TSelectOption[] = []
): string {
  if (job.resourceType === ExportResourceType.EXPENSES) {
    return formatExpenseExportFilterSummary(job.filters, categoryOptions);
  }
  return "—";
}
