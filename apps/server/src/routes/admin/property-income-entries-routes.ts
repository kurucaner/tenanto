import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyIncomeEntriesDb } from "@/db/property-income-entries";
import {
  HttpStatus,
  IncomeEntryKind,
  type IPropertyIncomeEntriesListQuery,
  ReservationStatus,
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
      const { entries, meta, nextCursor } = await propertyIncomeEntriesDb.listPaginatedByProperty(
        propertyId,
        parsed.filters,
        { cursor: parsed.cursor, includeDeleted, limit: parsed.limit }
      );

      return reply.send(meta ? { entries, meta, nextCursor } : { entries, nextCursor });
    }
  );
};
