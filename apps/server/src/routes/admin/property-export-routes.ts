import type { FastifyInstance } from "fastify";

import { exportJobsDb } from "@/db/export-jobs";
import { parseCategoryId, parseDateString } from "@/lib/validate-create-expense-body";
import {
  ExportFormat,
  ExportResourceType,
  HttpStatus,
  type IExportJobDownloadResponse,
  type IPropertyExportCreateRequest,
  type IPropertyExportDetailResponse,
  type IPropertyExportsListResponse,
  PROPERTY_EXPORTS_LIST_LIMIT,
  PROPERTY_EXPORTS_LIST_MAX_LIMIT,
  type TPropertyExpensesListFilters,
} from "@/packages/shared";
import { decodeKeysetCursor } from "@/pagination/keyset-cursor";
import { generateDownloadUrl } from "@/s3/s3-commands";
import {
  createPropertyExport,
  PropertyExportDuplicateError,
  PropertyExportRowLimitError,
  PropertyExportValidationError,
} from "@/services/property-export/property-export-service";

import { parseUuidParam } from "./admin-query-utils";
import { parseJsonObject } from "./parse-body-utils";
import { applyOptionalQuerySearchFilter } from "./parse-list-query-filters";
import { assertPropertyMemberAccess } from "./property-route-access";

function parseExportsListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return PROPERTY_EXPORTS_LIST_LIMIT;
  return Math.min(PROPERTY_EXPORTS_LIST_MAX_LIMIT, Math.floor(n));
}

function parseExpenseExportFilters(
  raw: unknown
): { filters: TPropertyExpensesListFilters; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { filters: {}, ok: true };
  }

  const record = raw as Record<string, unknown>;
  const filters: TPropertyExpensesListFilters = {};

  if (record.from !== undefined && record.from !== "") {
    const from = parseDateString(record.from);
    if (!from) return { error: "filters.from must be a YYYY-MM-DD date", ok: false };
    filters.from = from;
  }
  if (record.to !== undefined && record.to !== "") {
    const to = parseDateString(record.to);
    if (!to) return { error: "filters.to must be a YYYY-MM-DD date", ok: false };
    filters.to = to;
  }
  if (record.categoryId !== undefined && record.categoryId !== "") {
    const categoryId = parseCategoryId(record.categoryId);
    if (categoryId === null) {
      return { error: "filters.categoryId must be a valid UUID", ok: false };
    }
    filters.categoryId = categoryId;
  }

  const searchResult = applyOptionalQuerySearchFilter(record, filters);
  if (!searchResult.ok) {
    return searchResult;
  }

  return { filters, ok: true };
}

function parseCreateExportBody(
  raw: unknown
): { body: IPropertyExportCreateRequest; ok: true } | { error: string; ok: false } {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return { error: "Invalid JSON body", ok: false };
  }

  const resourceType = parsed.resourceType;
  const format = parsed.format;

  if (resourceType !== ExportResourceType.EXPENSES) {
    return { error: "resourceType must be expenses", ok: false };
  }
  if (format !== ExportFormat.CSV && format !== ExportFormat.XLSX) {
    return { error: "format must be csv or xlsx", ok: false };
  }

  const filtersResult = parseExpenseExportFilters(parsed.filters);
  if (!filtersResult.ok) {
    return { error: filtersResult.error, ok: false };
  }

  return {
    body: {
      filters: filtersResult.filters,
      format,
      resourceType,
    },
    ok: true,
  };
}

export const propertyExportRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.post<{ Params: { propertyId: string } }>(
    "/properties/:propertyId/exports",
    { preHandler: authPre },
    async (request, reply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (!propertyId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid property id" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyMemberAccess(propertyId, userId, userType, reply);
      if (!allowed) {
        return;
      }

      const parsedBody = parseCreateExportBody(request.body);
      if (!parsedBody.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsedBody.error });
      }

      try {
        const result = await createPropertyExport(propertyId, userId, parsedBody.body);
        return reply.status(HttpStatus.ACCEPTED).send(result);
      } catch (error) {
        if (error instanceof PropertyExportDuplicateError) {
          return reply.status(HttpStatus.CONFLICT).send({
            error: error.message,
            jobId: error.existingJobId,
          });
        }
        if (error instanceof PropertyExportRowLimitError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        if (error instanceof PropertyExportValidationError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  server.get<{ Params: { propertyId: string } }>(
    "/properties/:propertyId/exports",
    { preHandler: authPre },
    async (request, reply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (!propertyId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid property id" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyMemberAccess(propertyId, userId, userType, reply);
      if (!allowed) {
        return;
      }

      const query = request.query as Record<string, unknown>;
      const limit = parseExportsListLimit(query["limit"]);
      const cursor =
        typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

      if (cursor != null) {
        try {
          decodeKeysetCursor(cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const result: IPropertyExportsListResponse = await exportJobsDb.listPaginatedByProperty(
        propertyId,
        { cursor, limit }
      );

      return reply.send(result);
    }
  );

  server.get<{ Params: { jobId: string; propertyId: string } }>(
    "/properties/:propertyId/exports/:jobId",
    { preHandler: authPre },
    async (request, reply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      const jobId = parseUuidParam(request.params.jobId);
      if (!propertyId || !jobId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid id" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyMemberAccess(propertyId, userId, userType, reply);
      if (!allowed) {
        return;
      }

      const job = await exportJobsDb.findByIdForProperty(propertyId, jobId);
      if (job == null) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Export job not found" });
      }

      const response: IPropertyExportDetailResponse = { job };
      return reply.send(response);
    }
  );

  server.get<{ Params: { jobId: string; propertyId: string } }>(
    "/properties/:propertyId/exports/:jobId/download",
    { preHandler: authPre },
    async (request, reply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      const jobId = parseUuidParam(request.params.jobId);
      if (!propertyId || !jobId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid id" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyMemberAccess(propertyId, userId, userType, reply);
      if (!allowed) {
        return;
      }

      const downloadRow = await exportJobsDb.findDownloadRow(propertyId, jobId);
      if (downloadRow == null) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Export job not found" });
      }

      if (downloadRow.status !== "completed") {
        return reply
          .status(HttpStatus.FORBIDDEN)
          .send({ error: "Export is not ready to download" });
      }

      if (downloadRow.s3Key == null || downloadRow.expiresAt == null) {
        return reply.status(HttpStatus.FORBIDDEN).send({ error: "Export file is unavailable" });
      }

      if (downloadRow.expiresAt.getTime() <= Date.now()) {
        await exportJobsDb.markExpired(jobId);
        return reply.status(HttpStatus.FORBIDDEN).send({ error: "Export has expired" });
      }

      const downloadUrl = await generateDownloadUrl(downloadRow.s3Key);
      const response: IExportJobDownloadResponse = {
        downloadUrl,
        expiresAt: downloadRow.expiresAt.toISOString(),
      };
      return reply.send(response);
    }
  );
};
