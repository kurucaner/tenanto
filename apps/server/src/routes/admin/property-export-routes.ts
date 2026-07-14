import type { FastifyInstance } from "fastify";

import { exportJobsDb } from "@/db/export-jobs";
import {
  HttpStatus,
  type IExportJobDownloadResponse,
  type IPropertyExportDetailResponse,
  type IPropertyExportsListResponse,
  PROPERTY_EXPORTS_LIST_LIMIT,
  PROPERTY_EXPORTS_LIST_MAX_LIMIT,
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
import { parseCreateExportBody } from "./parse-property-export-body";
import { assertPropertyMemberAccess } from "./property-route-access";

function parseExportsListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return PROPERTY_EXPORTS_LIST_LIMIT;
  return Math.min(PROPERTY_EXPORTS_LIST_MAX_LIMIT, Math.floor(n));
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
