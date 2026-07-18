import type { FastifyReply, FastifyRequest } from "fastify";

import { HttpStatus, type IPropertyReportsQuery } from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";
import { assertPropertyMemberAccess } from "./property-route-access";
import { parseReportsQuery } from "./report-query";

export interface IPropertyParams {
  propertyId: string;
}

export async function loadPropertyReportContext(
  request: FastifyRequest<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>,
  reply: FastifyReply
): Promise<{ propertyId: string; query: IPropertyReportsQuery } | null> {
  const propertyId = parseUuidParam(request.params.propertyId);
  if (propertyId === null) {
    await reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
    return null;
  }

  const hasAccess = await assertPropertyMemberAccess(
    propertyId,
    request.user.userId,
    request.user.userType,
    reply
  );
  if (!hasAccess) return null;

  const parsed = parseReportsQuery(request.query);
  if (!parsed.ok) {
    await reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
    return null;
  }

  return { propertyId, query: parsed.query };
}
