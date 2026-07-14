import {
  buildExportJobsCursorPredicate,
  buildExportJobsOrderByClause,
  readExportJobSortKeyFromRow,
  resolveExportJobsListSort,
} from "@/db/export-jobs-list-sort";
import { serializeExportJobFilters } from "@/lib/property-export-filters";
import type {
  IExportJob,
  IPropertyExportsListMeta,
  IPropertyExportsListResponse,
  TExportFormat,
  TExportJobFilters,
  TExportJobStatus,
  TExportResourceType,
  TPropertyExpensesListFilters,
  TPropertyExportsListFilters,
  TPropertyIncomeEntriesListFilters,
  TPropertyLongStaysListFilters,
} from "@/packages/shared";
import { ExportResourceType, toIso } from "@/packages/shared";
import {
  decodeExportJobKeysetCursor,
  encodeExportJobKeysetCursor,
} from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";
import { shouldIncludeListMeta } from "@/pagination/should-include-list-meta";

import { pool } from "./pool";

function isFilterRecord(raw: unknown): raw is Record<string, unknown> {
  return raw != null && typeof raw === "object" && !Array.isArray(raw);
}

function assignOptionalNonEmptyStrings(
  record: Record<string, unknown>,
  filters: Record<string, unknown>,
  keys: readonly string[]
): void {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value !== "") {
      filters[key] = value;
    }
  }
}

function applyStoredIncomeExportEnumFilters(
  record: Record<string, unknown>,
  filters: TPropertyIncomeEntriesListFilters
): void {
  const { refundStatus, sortBy, sortDir, status } = record;

  if (
    status === "active" ||
    status === "canceled" ||
    status === "no_show" ||
    status === "stayed"
  ) {
    filters.status = status;
  }

  if (refundStatus === "refunded" || refundStatus === "not_refunded") {
    filters.refundStatus = refundStatus;
  }

  if (typeof sortBy === "string" && sortBy !== "") {
    filters.sortBy = sortBy as TPropertyIncomeEntriesListFilters["sortBy"];
  }

  if (sortDir === "asc" || sortDir === "desc") {
    filters.sortDir = sortDir;
  }
}

export interface ICreateExportJobInput {
  createdBy: string;
  filters: TExportJobFilters;
  format: TExportFormat;
  propertyId: string;
  resourceType: TExportResourceType;
}

export interface IExpiredExportJobRow {
  id: string;
  propertyId: string;
  s3Key: string | null;
}

function parseExpenseFilters(raw: unknown): TPropertyExpensesListFilters {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const filters: TPropertyExpensesListFilters = {};
  if (typeof record.from === "string" && record.from !== "") {
    filters.from = record.from;
  }
  if (typeof record.to === "string" && record.to !== "") {
    filters.to = record.to;
  }
  if (typeof record.categoryId === "string" && record.categoryId !== "") {
    filters.categoryId = record.categoryId;
  }
  if (typeof record.q === "string" && record.q !== "") {
    filters.q = record.q;
  }
  return filters;
}

function parseIncomeExportFilters(raw: unknown): TPropertyIncomeEntriesListFilters {
  if (!isFilterRecord(raw)) {
    return {};
  }

  const filters: TPropertyIncomeEntriesListFilters = {};
  assignOptionalNonEmptyStrings(raw, filters, [
    "channelCommissionId",
    "from",
    "incomeType",
    "q",
    "to",
    "unitId",
  ]);
  applyStoredIncomeExportEnumFilters(raw, filters);
  return filters;
}

function parseLeaseExportFilters(raw: unknown): TPropertyLongStaysListFilters {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const filters: TPropertyLongStaysListFilters = {};
  if (typeof record.from === "string" && record.from !== "") filters.from = record.from;
  if (typeof record.to === "string" && record.to !== "") filters.to = record.to;
  if (typeof record.unitId === "string" && record.unitId !== "") filters.unitId = record.unitId;
  if (typeof record.q === "string" && record.q !== "") filters.q = record.q;
  if (record.status === "active" || record.status === "ended") {
    filters.status = record.status;
  }
  return filters;
}

function parseExportJobFilters(resourceType: TExportResourceType, raw: unknown): TExportJobFilters {
  if (resourceType === ExportResourceType.INCOME) {
    return parseIncomeExportFilters(raw);
  }
  if (resourceType === ExportResourceType.LEASES) {
    return parseLeaseExportFilters(raw);
  }
  return parseExpenseFilters(raw);
}

function mapExportJobRow(row: Record<string, unknown>): IExportJob {
  const resourceType = row.resource_type as TExportResourceType;
  const filters = parseExportJobFilters(resourceType, row.filters);

  return {
    completedAt: toIso(row.completed_at),
    createdAt: (row.created_at as Date).toISOString(),
    createdBy: row.created_by as string,
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    expiresAt: toIso(row.expires_at),
    fileName: typeof row.file_name === "string" ? row.file_name : null,
    filters,
    format: row.format as TExportFormat,
    id: row.id as string,
    propertyId: row.property_id as string,
    resourceType,
    rowCount: typeof row.row_count === "number" ? row.row_count : null,
    status: row.status as TExportJobStatus,
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function buildExportJobsListConditions(
  propertyId: string,
  filters: TPropertyExportsListFilters = {}
): { conditions: string[]; values: unknown[] } {
  const conditions = ["property_id = $1"];
  const values: unknown[] = [propertyId];
  let p = 2;

  if (filters.from != null && filters.from !== "") {
    conditions.push(`created_at >= $${p++}::date`);
    values.push(filters.from);
  }

  if (filters.to != null && filters.to !== "") {
    conditions.push(`created_at < ($${p++}::date + interval '1 day')`);
    values.push(filters.to);
  }

  if (filters.resourceType != null) {
    conditions.push(`resource_type = $${p++}`);
    values.push(filters.resourceType);
  }

  const qTrim = filters.q?.trim();
  if (qTrim) {
    conditions.push(`(file_name ILIKE $${p} OR id::text ILIKE $${p})`);
    values.push(`%${qTrim}%`);
  }

  return { conditions, values };
}

export const exportJobsDb = {
  async create(input: ICreateExportJobInput): Promise<IExportJob> {
    const filtersJson = serializeExportJobFilters(input.resourceType, input.filters);
    const result = await pool.query(
      `INSERT INTO export_jobs (
         property_id,
         created_by,
         resource_type,
         format,
         filters,
         status
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')
       RETURNING *`,
      [input.propertyId, input.createdBy, input.resourceType, input.format, filtersJson]
    );
    return mapExportJobRow(result.rows[0] as Record<string, unknown>);
  },

  async findActiveDuplicate(input: ICreateExportJobInput): Promise<IExportJob | null> {
    const filtersJson = serializeExportJobFilters(input.resourceType, input.filters);
    const result = await pool.query(
      `SELECT * FROM export_jobs
       WHERE property_id = $1
         AND created_by = $2
         AND resource_type = $3
         AND format = $4
         AND filters = $5::jsonb
         AND status IN ('pending', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.propertyId, input.createdBy, input.resourceType, input.format, filtersJson]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row == null ? null : mapExportJobRow(row);
  },

  async findById(id: string): Promise<IExportJob | null> {
    const result = await pool.query(`SELECT * FROM export_jobs WHERE id = $1`, [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row == null ? null : mapExportJobRow(row);
  },

  async findByIdForProperty(propertyId: string, jobId: string): Promise<IExportJob | null> {
    const result = await pool.query(
      `SELECT * FROM export_jobs WHERE id = $1 AND property_id = $2`,
      [jobId, propertyId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row == null ? null : mapExportJobRow(row);
  },

  async findDownloadRow(
    propertyId: string,
    jobId: string
  ): Promise<{
    expiresAt: Date | null;
    s3Key: string | null;
    status: TExportJobStatus;
  } | null> {
    const result = await pool.query(
      `SELECT status, s3_key, expires_at FROM export_jobs WHERE id = $1 AND property_id = $2`,
      [jobId, propertyId]
    );
    const row = result.rows[0] as
      { expires_at: Date | null; s3_key: string | null; status: TExportJobStatus } | undefined;
    if (row == null) {
      return null;
    }
    return {
      expiresAt: row.expires_at,
      s3Key: row.s3_key,
      status: row.status,
    };
  },

  async getListMetaByProperty(
    propertyId: string,
    filters: TPropertyExportsListFilters = {}
  ): Promise<IPropertyExportsListMeta> {
    const { conditions, values } = buildExportJobsListConditions(propertyId, filters);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total_count FROM export_jobs WHERE ${conditions.join(" AND ")}`,
      values
    );
    const row = result.rows[0] as { total_count: number } | undefined;
    return { totalCount: row?.total_count ?? 0 };
  },

  async listPaginatedByProperty(
    propertyId: string,
    options: { cursor?: string; filters?: TPropertyExportsListFilters; limit: number }
  ): Promise<IPropertyExportsListResponse> {
    const filters = options.filters ?? {};
    const includeMeta = shouldIncludeListMeta(options.cursor);
    const listPromise = exportJobsDb.listPaginatedPage(propertyId, options);
    const metaPromise = includeMeta
      ? exportJobsDb.getListMetaByProperty(propertyId, filters)
      : Promise.resolve(undefined);

    const [{ exports: jobs, nextCursor }, meta] = await Promise.all([listPromise, metaPromise]);

    return meta == null ? { exports: jobs, nextCursor } : { exports: jobs, meta, nextCursor };
  },

  async listPaginatedPage(
    propertyId: string,
    options: { cursor?: string; filters?: TPropertyExportsListFilters; limit: number }
  ): Promise<{ exports: IExportJob[]; nextCursor: string | null }> {
    const filters = options.filters ?? {};
    const sort = resolveExportJobsListSort(filters.sortBy, filters.sortDir);
    const { conditions, values } = buildExportJobsListConditions(propertyId, filters);
    let p = values.length + 1;

    if (options.cursor != null && options.cursor !== "") {
      const decoded = decodeExportJobKeysetCursor(options.cursor);
      if (decoded.sortBy !== sort.sortBy || decoded.sortDir !== sort.sortDir) {
        throw new Error("Invalid cursor");
      }

      const { nextParamIndex, predicate } = buildExportJobsCursorPredicate(sort, p);
      conditions.push(predicate);
      values.push(decoded.sortKey, decoded.createdAt, decoded.id);
      p = nextParamIndex;
    }

    const limitParam = p;
    values.push(options.limit + 1);
    const orderByClause = buildExportJobsOrderByClause(sort);

    const result = await pool.query(
      `SELECT * FROM export_jobs
       WHERE ${conditions.join(" AND ")}
       ${orderByClause}
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeExportJobKeysetCursor({
        createdAt: last.created_at as Date | string,
        id: last.id as string,
        sortBy: sort.sortBy,
        sortDir: sort.sortDir,
        sortKey: readExportJobSortKeyFromRow(sort, last),
      })
    );

    return {
      exports: pageRows.map((row) => mapExportJobRow(row)),
      nextCursor,
    };
  },

  async listPastExpiryCompletedJobs(): Promise<IExpiredExportJobRow[]> {
    const result = await pool.query(
      `SELECT id, property_id, s3_key
       FROM export_jobs
       WHERE status = 'completed'
         AND expires_at IS NOT NULL
         AND expires_at <= NOW()
       ORDER BY expires_at ASC`
    );
    return result.rows.map((row) => {
      const record = row as { id: string; property_id: string; s3_key: string | null };
      return {
        id: record.id,
        propertyId: record.property_id,
        s3Key: record.s3_key,
      };
    });
  },

  async listStuckJobIds(): Promise<string[]> {
    const result = await pool.query(
      `SELECT id FROM export_jobs
       WHERE status IN ('pending', 'processing')
       ORDER BY created_at ASC`
    );
    return result.rows.map((row) => (row as { id: string }).id);
  },

  async listTimedOutProcessingJobIds(cutoff: Date): Promise<string[]> {
    const result = await pool.query(
      `SELECT id FROM export_jobs
       WHERE status = 'processing'
         AND updated_at < $1
       ORDER BY updated_at ASC`,
      [cutoff]
    );
    return result.rows.map((row) => (row as { id: string }).id);
  },

  async markCompleted(
    id: string,
    input: {
      expiresAt: Date;
      fileName: string;
      rowCount: number;
      s3Key: string;
    }
  ): Promise<IExportJob | null> {
    const result = await pool.query(
      `UPDATE export_jobs
       SET status = 'completed',
           row_count = $2,
           file_name = $3,
           s3_key = $4,
           expires_at = $5,
           completed_at = NOW(),
           error_message = NULL
       WHERE id = $1 AND status = 'processing'
       RETURNING *`,
      [id, input.rowCount, input.fileName, input.s3Key, input.expiresAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row == null ? null : mapExportJobRow(row);
  },

  async markExpired(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE export_jobs
       SET status = 'expired'
       WHERE id = $1 AND status = 'completed'`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async markFailed(id: string, errorMessage: string): Promise<IExportJob | null> {
    const result = await pool.query(
      `UPDATE export_jobs
       SET status = 'failed',
           error_message = $2,
           completed_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'processing')
       RETURNING *`,
      [id, errorMessage.slice(0, 2000)]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row == null ? null : mapExportJobRow(row);
  },

  async markProcessing(id: string): Promise<IExportJob | null> {
    const result = await pool.query(
      `UPDATE export_jobs
       SET status = 'processing'
       WHERE id = $1 AND status IN ('pending', 'processing')
       RETURNING *`,
      [id]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row == null ? null : mapExportJobRow(row);
  },
};
