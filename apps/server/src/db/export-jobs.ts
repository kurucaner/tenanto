import { serializeExpenseExportFilters } from "@/lib/property-export-filters";
import type {
  IExportJob,
  IPropertyExportsListMeta,
  IPropertyExportsListResponse,
  TExportFormat,
  TExportJobStatus,
  TExportResourceType,
  TPropertyExpensesListFilters,
} from "@/packages/shared";
import { toIso } from "@/packages/shared";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";
import { shouldIncludeListMeta } from "@/pagination/should-include-list-meta";

import { pool } from "./pool";

export interface ICreateExportJobInput {
  createdBy: string;
  filters: TPropertyExpensesListFilters;
  format: TExportFormat;
  propertyId: string;
  resourceType: TExportResourceType;
}

export interface IFindActiveExportDuplicateInput {
  createdBy: string;
  filters: TPropertyExpensesListFilters;
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

function mapExportJobRow(row: Record<string, unknown>): IExportJob {
  const resourceType = row.resource_type as TExportResourceType;
  const filters = parseExpenseFilters(row.filters);

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

export const exportJobsDb = {
  async create(input: ICreateExportJobInput): Promise<IExportJob> {
    const filtersJson = serializeExpenseExportFilters(input.filters);
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

  async findActiveDuplicate(input: IFindActiveExportDuplicateInput): Promise<IExportJob | null> {
    const filtersJson = serializeExpenseExportFilters(input.filters);
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

  async getListMetaByProperty(propertyId: string): Promise<IPropertyExportsListMeta> {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total_count FROM export_jobs WHERE property_id = $1`,
      [propertyId]
    );
    const row = result.rows[0] as { total_count: number } | undefined;
    return { totalCount: row?.total_count ?? 0 };
  },

  async listPaginatedByProperty(
    propertyId: string,
    options: { cursor?: string; limit: number }
  ): Promise<IPropertyExportsListResponse> {
    const includeMeta = shouldIncludeListMeta(options.cursor);
    const listPromise = exportJobsDb.listPaginatedPage(propertyId, options);
    const metaPromise = includeMeta
      ? exportJobsDb.getListMetaByProperty(propertyId)
      : Promise.resolve(undefined);

    const [{ exports: jobs, nextCursor }, meta] = await Promise.all([listPromise, metaPromise]);

    return meta == null ? { exports: jobs, nextCursor } : { exports: jobs, meta, nextCursor };
  },

  async listPaginatedPage(
    propertyId: string,
    options: { cursor?: string; limit: number }
  ): Promise<{ exports: IExportJob[]; nextCursor: string | null }> {
    const conditions = ["property_id = $1"];
    const values: unknown[] = [propertyId];
    let p = 2;

    if (options.cursor != null && options.cursor !== "") {
      const decoded = decodeKeysetCursor(options.cursor);
      conditions.push(`(created_at, id) < ($${p++}::timestamptz, $${p++}::uuid)`);
      values.push(decoded.createdAt, decoded.id);
    }

    const limitParam = p;
    values.push(options.limit + 1);

    const result = await pool.query(
      `SELECT * FROM export_jobs
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeKeysetCursor(last.created_at as Date | string, last.id as string)
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
