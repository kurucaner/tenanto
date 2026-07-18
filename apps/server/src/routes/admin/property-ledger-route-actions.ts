import type { FastifyReply } from "fastify";

import { HttpStatus } from "@/packages/shared";

import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";
import {
  getAuthenticatedRequestParams,
  IPropertyParams,
  parseNestedUuidParam,
  parsePropertyIdParam,
  type TAuthenticatedRequest,
} from "./property-route-params";
import { rejectIfDeleted } from "./reject-if-deleted";
import { rejectIfRefunded } from "./reject-if-refunded";

const DEFAULT_LEDGER_FORBIDDEN_MESSAGE =
  "Only property owners and managers can manage income entries";

export async function requirePropertyLedgerEntityIds<
  TParams extends IPropertyParams,
>(
  request: TAuthenticatedRequest<TParams>,
  reply: FastifyReply,
  entityParamName: keyof TParams & string,
  entityParamLabel: string,
  options?: { ledgerForbiddenMessage?: string }
): Promise<{ entityId: string; propertyId: string } | null> {
  const params = getAuthenticatedRequestParams(request);
  const propertyId = parsePropertyIdParam(params.propertyId, reply);
  if (propertyId === null) return null;

  const hasAccess = await assertPropertyMemberAccess(
    propertyId,
    request.user.userId,
    request.user.userType,
    reply
  );
  if (!hasAccess) return null;

  const entityId = parseNestedUuidParam(
    params[entityParamName],
    entityParamLabel,
    reply
  );
  if (entityId === null) return null;

  const canWrite = await assertPropertyLedgerWriteAccess(
    propertyId,
    request.user.userId,
    request.user.userType,
    reply,
    options?.ledgerForbiddenMessage ?? DEFAULT_LEDGER_FORBIDDEN_MESSAGE
  );
  if (!canWrite) return null;

  return { entityId, propertyId };
}

export async function loadScopedLedgerEntity<
  T extends { isDeleted: boolean; propertyId: string; refundedAt: string | null },
>(
  reply: FastifyReply,
  options: {
    entity: T | null;
    label: string;
    notFoundError: string;
    propertyId: string;
    rejectRefunded?: boolean;
  }
): Promise<T | null> {
  if (!options.entity || options.entity.propertyId !== options.propertyId) {
    void reply.status(HttpStatus.NOT_FOUND).send({ error: options.notFoundError });
    return null;
  }

  if (rejectIfDeleted(options.entity, reply, options.label)) {
    return null;
  }

  if (options.rejectRefunded && rejectIfRefunded(options.entity, reply, options.label)) {
    return null;
  }

  return options.entity;
}

export async function executeLedgerSoftDelete<
  T extends { isDeleted: boolean; propertyId: string; refundedAt: string | null },
>(
  reply: FastifyReply,
  options: {
    entity: T | null;
    entityId: string;
    label: string;
    notFoundError: string;
    propertyId: string;
    softDelete: (id: string) => Promise<void>;
  }
): Promise<boolean> {
  const entity = await loadScopedLedgerEntity(reply, {
    entity: options.entity,
    label: options.label,
    notFoundError: options.notFoundError,
    propertyId: options.propertyId,
  });
  if (!entity) return false;

  await options.softDelete(options.entityId);
  await reply.status(HttpStatus.NO_CONTENT).send();
  return true;
}
