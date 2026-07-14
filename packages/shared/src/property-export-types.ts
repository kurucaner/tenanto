import type { IPropertyExportsListMeta } from "./list-meta-types";
import type { TPropertyExpensesListFilters } from "./property-expense-types";
import type { TPropertyIncomeEntriesListFilters } from "./property-income-entries-types";
import type { TPropertyLongStaysListFilters } from "./property-long-stay-types";

export type TExportJobStatus = "completed" | "expired" | "failed" | "pending" | "processing";

export const ExportJobStatus = {
  COMPLETED: "completed",
  EXPIRED: "expired",
  FAILED: "failed",
  PENDING: "pending",
  PROCESSING: "processing",
} as const satisfies Record<string, TExportJobStatus>;

export type TExportFormat = "csv" | "xlsx";

export const ExportFormat = {
  CSV: "csv",
  XLSX: "xlsx",
} as const satisfies Record<string, TExportFormat>;

export type TExportResourceType = "expenses" | "income" | "leases";

export const ExportResourceType = {
  EXPENSES: "expenses",
  INCOME: "income",
  LEASES: "leases",
} as const satisfies Record<string, TExportResourceType>;

export type TExportJobFilters =
  TPropertyExpensesListFilters | TPropertyIncomeEntriesListFilters | TPropertyLongStaysListFilters;

export type IPropertyExportCreateRequest =
  | {
      filters: TPropertyExpensesListFilters;
      format: TExportFormat;
      resourceType: "expenses";
    }
  | {
      filters: TPropertyIncomeEntriesListFilters;
      format: TExportFormat;
      resourceType: "income";
    }
  | {
      filters: TPropertyLongStaysListFilters;
      format: TExportFormat;
      resourceType: "leases";
    };

export interface IPropertyExportCreateResponse {
  jobId: string;
}

export interface IExportJob {
  completedAt: string | null;
  createdAt: string;
  createdBy: string;
  errorMessage: string | null;
  expiresAt: string | null;
  fileName: string | null;
  filters: TExportJobFilters;
  format: TExportFormat;
  id: string;
  propertyId: string;
  resourceType: TExportResourceType;
  rowCount: number | null;
  status: TExportJobStatus;
  updatedAt: string;
}

export interface IPropertyExportDetailResponse {
  job: IExportJob;
}

export type TPropertyExportsListSortBy =
  "format" | "requestedAt" | "resourceType" | "rowCount" | "status";

export type TPropertyExportsListSortDir = "asc" | "desc";

export const PROPERTY_EXPORTS_DEFAULT_SORT_BY: TPropertyExportsListSortBy = "requestedAt";
export const PROPERTY_EXPORTS_DEFAULT_SORT_DIR: TPropertyExportsListSortDir = "desc";

export const PROPERTY_EXPORTS_SORT_BY_VALUES = [
  "requestedAt",
  "resourceType",
  "format",
  "status",
  "rowCount",
] as const satisfies readonly TPropertyExportsListSortBy[];

export const PROPERTY_EXPORTS_SORT_DIR_VALUES = [
  "asc",
  "desc",
] as const satisfies readonly TPropertyExportsListSortDir[];

export type TPropertyExportsListFilters = {
  from?: string;
  q?: string;
  resourceType?: TExportResourceType;
  sortBy?: TPropertyExportsListSortBy;
  sortDir?: TPropertyExportsListSortDir;
  to?: string;
};

export interface IPropertyExportsListQuery extends TPropertyExportsListFilters {
  cursor?: string;
  limit?: number;
}

export interface IPropertyExportsListResponse {
  exports: IExportJob[];
  meta?: IPropertyExportsListMeta;
  nextCursor: string | null;
}

export interface IExportJobDownloadResponse {
  downloadUrl: string;
  expiresAt: string;
}
