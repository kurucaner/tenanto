import type { IPropertyExportsListMeta } from "./list-meta-types";
import type { TPropertyExpensesListFilters } from "./property-expense-types";

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

export type TExportResourceType = "expenses";

export const ExportResourceType = {
  EXPENSES: "expenses",
} as const satisfies Record<string, TExportResourceType>;

export type IPropertyExportCreateRequest =
  | {
      filters: TPropertyExpensesListFilters;
      format: TExportFormat;
      resourceType: "expenses";
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
  filters: TPropertyExpensesListFilters;
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

export interface IPropertyExportsListQuery {
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
