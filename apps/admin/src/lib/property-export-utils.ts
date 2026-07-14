import { buildIncomeTypeFilterOptions } from "@/components/income/income-line-form-options";
import { buildChannelOptions, STATUS_OPTIONS } from "@/components/income/reservation-form-options";
import { type TSelectOption } from "@/lib/select-option-types";
import {
  ExportFormat,
  ExportJobStatus,
  ExportResourceType,
  formatPropertyUnitSelectLabel,
  type IExportJob,
  IncomeRefundFilter,
  type IPropertyExportCreateRequest,
  type IPropertySettings,
  type IPropertyUnit,
  type TExportFormat,
  type TExportJobStatus,
  type TExportResourceType,
  type TPropertyExpensesListFilters,
  type TPropertyIncomeEntriesListFilters,
  type TPropertyLongStaysListFilters,
} from "@/packages/shared";

export const INCOME_REFUND_STATUS_FILTER_OPTIONS: readonly TSelectOption[] = [
  { label: "All incomes", value: "" },
  { label: "Refunded", value: IncomeRefundFilter.REFUNDED },
  { label: "Not refunded", value: IncomeRefundFilter.NOT_REFUNDED },
];

export const LEASE_STATUS_FILTER_OPTIONS: readonly TSelectOption[] = [
  { label: "All leases", value: "" },
  { label: "Active", value: "active" },
  { label: "Ended", value: "ended" },
];

export type TPropertyTableExportConfig =
  | { filters: TPropertyExpensesListFilters; resourceType: typeof ExportResourceType.EXPENSES }
  | { filters: TPropertyIncomeEntriesListFilters; resourceType: typeof ExportResourceType.INCOME }
  | { filters: TPropertyLongStaysListFilters; resourceType: typeof ExportResourceType.LEASES };

export interface IExportFilterSummaryOptions {
  categoryOptions: readonly TSelectOption[];
  channelOptions: readonly TSelectOption[];
  incomeTypeOptions: readonly TSelectOption[];
  leaseStatusOptions: readonly TSelectOption[];
  refundStatusOptions: readonly TSelectOption[];
  reservationStatusOptions: readonly TSelectOption[];
  unitOptions: readonly TSelectOption[];
}

function findOptionLabel(options: readonly TSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function buildExportFilterSummaryOptions(
  settings: IPropertySettings | undefined,
  units: readonly IPropertyUnit[]
): IExportFilterSummaryOptions {
  const activeUnits = units.filter((unit) => !unit.isDeleted);
  const unitOptions = activeUnits.map((unit) => ({
    label: formatPropertyUnitSelectLabel(unit),
    value: unit.id,
  }));

  return {
    categoryOptions: (settings?.expenseCategoryTypes ?? []).map((category) => ({
      label: category.name,
      value: category.id,
    })),
    channelOptions: buildChannelOptions(settings?.channelCommissions ?? []),
    incomeTypeOptions: buildIncomeTypeFilterOptions(settings?.incomeLineTypes ?? []),
    leaseStatusOptions: LEASE_STATUS_FILTER_OPTIONS,
    refundStatusOptions: INCOME_REFUND_STATUS_FILTER_OPTIONS,
    reservationStatusOptions: STATUS_OPTIONS,
    unitOptions,
  };
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

export function formatIncomeExportFilterSummary(
  filters: TPropertyIncomeEntriesListFilters,
  options: Pick<
    IExportFilterSummaryOptions,
    | "channelOptions"
    | "incomeTypeOptions"
    | "refundStatusOptions"
    | "reservationStatusOptions"
    | "unitOptions"
  >
): string {
  const parts: string[] = [];

  if (filters.from != null || filters.to != null) {
    parts.push(`${filters.from ?? "…"} – ${filters.to ?? "…"}`);
  }

  if (filters.unitId != null && filters.unitId !== "") {
    parts.push(`Unit: ${findOptionLabel(options.unitOptions, filters.unitId)}`);
  }

  if (filters.incomeType != null && filters.incomeType !== "") {
    parts.push(`Type: ${findOptionLabel(options.incomeTypeOptions, filters.incomeType)}`);
  }

  if (filters.channelCommissionId != null && filters.channelCommissionId !== "") {
    parts.push(`Channel: ${findOptionLabel(options.channelOptions, filters.channelCommissionId)}`);
  }

  if (filters.status != null) {
    parts.push(`Status: ${findOptionLabel(options.reservationStatusOptions, filters.status)}`);
  }

  if (filters.refundStatus != null) {
    parts.push(`Refund: ${findOptionLabel(options.refundStatusOptions, filters.refundStatus)}`);
  }

  const qTrim = filters.q?.trim();
  if (qTrim != null && qTrim !== "") {
    parts.push(`Search: ${qTrim}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "All income";
}

export function formatLeaseExportFilterSummary(
  filters: TPropertyLongStaysListFilters,
  options: Pick<IExportFilterSummaryOptions, "leaseStatusOptions" | "unitOptions">
): string {
  const parts: string[] = [];

  if (filters.from != null || filters.to != null) {
    parts.push(`${filters.from ?? "…"} – ${filters.to ?? "…"}`);
  }

  if (filters.unitId != null && filters.unitId !== "") {
    parts.push(`Unit: ${findOptionLabel(options.unitOptions, filters.unitId)}`);
  }

  if (filters.status != null) {
    parts.push(`Status: ${findOptionLabel(options.leaseStatusOptions, filters.status)}`);
  }

  const qTrim = filters.q?.trim();
  if (qTrim != null && qTrim !== "") {
    parts.push(`Search: ${qTrim}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "All leases";
}

export function formatPropertyTableExportFilterSummary(
  config: TPropertyTableExportConfig,
  options: IExportFilterSummaryOptions
): string {
  if (config.resourceType === ExportResourceType.EXPENSES) {
    return formatExpenseExportFilterSummary(config.filters, options.categoryOptions);
  }

  if (config.resourceType === ExportResourceType.INCOME) {
    return formatIncomeExportFilterSummary(config.filters, options);
  }

  return formatLeaseExportFilterSummary(config.filters, options);
}

export function buildPropertyExportCreateRequest(
  config: TPropertyTableExportConfig,
  format: TExportFormat
): IPropertyExportCreateRequest {
  if (config.resourceType === ExportResourceType.EXPENSES) {
    return {
      filters: config.filters,
      format,
      resourceType: ExportResourceType.EXPENSES,
    };
  }

  if (config.resourceType === ExportResourceType.INCOME) {
    return {
      filters: config.filters,
      format,
      resourceType: ExportResourceType.INCOME,
    };
  }

  return {
    filters: config.filters,
    format,
    resourceType: ExportResourceType.LEASES,
  };
}

export function getExportResourceTypeLabel(resourceType: TExportResourceType): string {
  if (resourceType === ExportResourceType.EXPENSES) {
    return "Expenses";
  }
  if (resourceType === ExportResourceType.INCOME) {
    return "Income";
  }
  if (resourceType === ExportResourceType.LEASES) {
    return "Leases";
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
  options: IExportFilterSummaryOptions
): string {
  if (job.resourceType === ExportResourceType.EXPENSES) {
    return formatExpenseExportFilterSummary(
      job.filters as TPropertyExpensesListFilters,
      options.categoryOptions
    );
  }

  if (job.resourceType === ExportResourceType.INCOME) {
    return formatIncomeExportFilterSummary(
      job.filters as TPropertyIncomeEntriesListFilters,
      options
    );
  }

  if (job.resourceType === ExportResourceType.LEASES) {
    return formatLeaseExportFilterSummary(job.filters as TPropertyLongStaysListFilters, options);
  }

  return "—";
}
