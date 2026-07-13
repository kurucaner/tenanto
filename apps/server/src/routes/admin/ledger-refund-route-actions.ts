import type { FastifyReply } from "fastify";

import { HttpStatus, type IRefundLedgerEntryBody, validateRefundAmount } from "@/packages/shared";

import { parseJsonObject, parseMoney } from "./parse-body-utils";

export interface ILedgerRefundableRecord {
  isDeleted: boolean;
  propertyId: string;
  refundedAt: string | null;
}

export interface ILedgerRefundDb {
  refund(id: string, userId: string, refundedAmount?: number): Promise<boolean>;
  unrefund(id: string): Promise<boolean>;
}

export function parseRefundLedgerEntryBody(
  raw: unknown
): { body: IRefundLedgerEntryBody; ok: true } | { error: string; ok: false } {
  if (raw === undefined || raw === null) {
    return { body: {}, ok: true };
  }

  const record = parseJsonObject(raw);
  if (record === null) {
    return { error: "Request body must be a JSON object", ok: false };
  }

  if (!("amount" in record)) {
    return { body: {}, ok: true };
  }

  const amount = parseMoney(record["amount"]);
  if (amount === null) {
    return { error: "amount must be a non-negative number", ok: false };
  }

  return { body: { amount }, ok: true };
}

export async function executeLedgerRefund(
  reply: FastifyReply,
  options: {
    body?: IRefundLedgerEntryBody;
    db: ILedgerRefundDb;
    entity: ILedgerRefundableRecord | null;
    entityId: string;
    entityName: string;
    label: string;
    notFoundError: string;
    propertyId: string;
    refundableCap: number;
    userId: string;
  }
): Promise<void> {
  const {
    body,
    db,
    entity,
    entityId,
    entityName,
    label,
    notFoundError,
    propertyId,
    refundableCap,
    userId,
  } = options;

  if (!entity || entity.propertyId !== propertyId) {
    await reply.status(HttpStatus.NOT_FOUND).send({ error: notFoundError });
    return;
  }

  if (entity.isDeleted) {
    await reply.status(HttpStatus.BAD_REQUEST).send({ error: `Cannot refund a deleted ${label}` });
    return;
  }

  if (entity.refundedAt !== null) {
    await reply.status(HttpStatus.CONFLICT).send({ error: `${entityName} is already refunded` });
    return;
  }

  const validated = validateRefundAmount(body, refundableCap);
  if (!validated.ok) {
    await reply.status(HttpStatus.BAD_REQUEST).send({ error: validated.error });
    return;
  }

  const updated = await db.refund(entityId, userId, validated.amount);
  if (!updated) {
    await reply.status(HttpStatus.CONFLICT).send({ error: `${entityName} is already refunded` });
    return;
  }

  await reply.status(HttpStatus.NO_CONTENT).send();
}

export async function executeLedgerUnrefund(
  reply: FastifyReply,
  options: {
    db: ILedgerRefundDb;
    entity: ILedgerRefundableRecord | null;
    entityId: string;
    entityName: string;
    notFoundError: string;
    propertyId: string;
  }
): Promise<void> {
  const { db, entity, entityId, entityName, notFoundError, propertyId } = options;

  if (!entity || entity.propertyId !== propertyId) {
    await reply.status(HttpStatus.NOT_FOUND).send({ error: notFoundError });
    return;
  }

  if (entity.refundedAt === null) {
    await reply.status(HttpStatus.CONFLICT).send({ error: `${entityName} is not refunded` });
    return;
  }

  const updated = await db.unrefund(entityId);
  if (!updated) {
    await reply.status(HttpStatus.CONFLICT).send({ error: `${entityName} is not refunded` });
    return;
  }

  await reply.status(HttpStatus.NO_CONTENT).send();
}
