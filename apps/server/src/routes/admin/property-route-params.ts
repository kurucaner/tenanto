import type { FastifyReply, FastifyRequest } from "fastify";

import { HttpStatus } from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";

export interface IPropertyParams {
  propertyId: string;
}

export interface IAuthenticatedRequestUser {
  userId: string;
  userType: string;
}

export type TAuthenticatedRequest<
  TParams extends IPropertyParams = IPropertyParams,
> = FastifyRequest<{ Params: TParams }> & {
  user: IAuthenticatedRequestUser;
};

export function getAuthenticatedRequestParams<TParams extends IPropertyParams>(
  request: TAuthenticatedRequest<TParams>
): TParams {
  return request.params as TParams;
}

export function parsePropertyIdParam(raw: unknown, reply: FastifyReply): string | null {
  const propertyId = parseUuidParam(raw);
  if (propertyId === null) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
    return null;
  }
  return propertyId;
}

export function parseNestedUuidParam(
  raw: unknown,
  paramName: string,
  reply: FastifyReply
): string | null {
  const id = parseUuidParam(raw);
  if (id === null) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: `Invalid ${paramName}` });
    return null;
  }
  return id;
}
