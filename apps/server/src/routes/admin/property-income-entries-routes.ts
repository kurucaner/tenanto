import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyIncomeEntriesDb } from "@/db/property-income-entries";
import {
  HttpStatus,
  INCOME_ENTRIES_SLOW_QUERY_MS,
  INCOME_ENTRIES_SORT_BY_VALUES,
  INCOME_ENTRIES_SORT_DIR_VALUES,
  IncomeEntryKind,
  type IPropertyIncomeEntriesListQuery,
  ReservationStatus,
  type TPropertyIncomeEntriesListSortBy,
  type TPropertyIncomeEntriesListSortDir,
  type TReservationStatus,
  UserType,
} from "@/packages/shared";
import { decodeIncomeEntryKeysetCursor } from "@/pagination/keyset-cursor";

import {
  parseIncomeEntriesListLimit,
  parseOptionalUuid,
  parseUuidParam,
} from "./admin-query-utils";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQuerySearchFilter,
  applyOptionalQueryUuidFilter,
} from "./parse-list-query-filters";
import { assertPropertyMemberAccess } from "./property-route-access";

const RESERVATION_STATUSES = new Set<TReservationStatus>(Object.values(ReservationStatus));

function parseReservationStatus(raw: unknown): TReservationStatus | null {
  if (typeof raw !== "string") return null;
  return RESERVATION_STATUSES.has(raw as TReservationStatus) ? (raw as TReservationStatus) : null;
}

function parseIncomeType(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  if (trimmed === IncomeEntryKind.STAY) return IncomeEntryKind.STAY;
  return parseOptionalUuid(trimmed) ?? null;
}

function parseIncomeEntriesSortBy(
  raw: unknown
): TPropertyIncomeEntriesListSortBy | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return (INCOME_ENTRIES_SORT_BY_VALUES as readonly string[]).includes(raw)
    ? (raw as TPropertyIncomeEntriesListSortBy)
    : null;
}

function parseIncomeEntriesSortDir(
  raw: unknown
): TPropertyIncomeEntriesListSortDir | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return (INCOME_ENTRIES_SORT_DIR_VALUES as readonly string[]).includes(raw)
    ? (raw as TPropertyIncomeEntriesListSortDir)
    : null;
}

function parseIncomeEntriesListQuery(query: Record<string, unknown>):
  | {
      cursor?: string;
      filters: Omit<IPropertyIncomeEntriesListQuery, "cursor" | "limit">;
      limit: number;
      ok: true;
    }
  | { error: string; ok: false } {
  const filters: Omit<IPropertyIncomeEntriesListQuery, "cursor" | "limit"> = {};

  const filterSteps = [
    () => applyOptionalQueryDateFilter(query, "from", filters, "from must be YYYY-MM-DD"),
    () => applyOptionalQueryDateFilter(query, "to", filters, "to must be YYYY-MM-DD"),
    () => applyOptionalQueryUuidFilter(query, "unitId", filters, "unitId must be a valid UUID"),
    () => applyOptionalQuerySearchFilter(query, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) return result;
  }

  if (query["channelCommissionId"] !== undefined && query["channelCommissionId"] !== "") {
    const channelCommissionId = parseOptionalUuid(query["channelCommissionId"]);
    if (channelCommissionId === null) {
      return { error: "channelCommissionId must be a valid UUID", ok: false };
    }
    if (channelCommissionId) {
      filters.channelCommissionId = channelCommissionId;
    }
  }

  if (query["status"] !== undefined && query["status"] !== "") {
    const status = parseReservationStatus(query["status"]);
    if (status === null) {
      return {
        error: `status must be one of: ${[...RESERVATION_STATUSES].join(", ")}`,
        ok: false,
      };
    }
    filters.status = status;
  }

  if (query["incomeType"] !== undefined && query["incomeType"] !== "") {
    const incomeType = parseIncomeType(query["incomeType"]);
    if (incomeType === null) {
      return {
        error: "incomeType must be 'stay' or a valid income line type id",
        ok: false,
      };
    }
    if (incomeType) {
      filters.incomeType = incomeType;
    }
  }

  const sortBy = parseIncomeEntriesSortBy(query["sortBy"]);
  if (sortBy === null) {
    return {
      error: `sortBy must be one of: ${INCOME_ENTRIES_SORT_BY_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (sortBy) {
    filters.sortBy = sortBy;
  }

  const sortDir = parseIncomeEntriesSortDir(query["sortDir"]);
  if (sortDir === null) {
    return {
      error: `sortDir must be one of: ${INCOME_ENTRIES_SORT_DIR_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (sortDir) {
    filters.sortDir = sortDir;
  }

  const limit = parseIncomeEntriesListLimit(query["limit"]);
  const cursor =
    typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

  return { cursor, filters, limit, ok: true };
}

interface IPropertyParams {
  propertyId: string;
}

export const propertyIncomeEntriesRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/income-entries",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const parsed = parseIncomeEntriesListQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      if (parsed.cursor != null) {
        try {
          decodeIncomeEntryKeysetCursor(parsed.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const includeDeleted = request.user.userType === UserType.ADMIN;
      const startedAt = performance.now();
      const { entries, meta, nextCursor } = await propertyIncomeEntriesDb.listPaginatedByProperty(
        propertyId,
        parsed.filters,
        { cursor: parsed.cursor, includeDeleted, limit: parsed.limit }
      );
      const durationMs = performance.now() - startedAt;

      request.log.info({
        cursor: parsed.cursor != null,
        durationMs: Math.round(durationMs),
        entryCount: entries.length,
        event: "income_entries_list",
        hasMeta: meta != null,
        limit: parsed.limit,
        propertyId,
        sortBy: parsed.filters.sortBy ?? "date",
        sortDir: parsed.filters.sortDir ?? "desc",
        userId: request.user.userId,
      });

      if (durationMs >= INCOME_ENTRIES_SLOW_QUERY_MS) {
        request.log.warn({
          durationMs: Math.round(durationMs),
          event: "income_entries_list_slow",
          limit: parsed.limit,
          propertyId,
          sortBy: parsed.filters.sortBy ?? "date",
          sortDir: parsed.filters.sortDir ?? "desc",
          thresholdMs: INCOME_ENTRIES_SLOW_QUERY_MS,
          userId: request.user.userId,
        });
      }

      return reply.send(meta ? { entries, meta, nextCursor } : { entries, nextCursor });
    }
  );
};
