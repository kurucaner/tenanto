import type { FastifyReply } from "fastify";

import { HttpStatus } from "@/packages/shared";

export interface ILedgerRefundableRecord {
  isDeleted: boolean;
  propertyId: string;
  refundedAt: string | null;
}

export interface ILedgerRefundDb {
  refund(id: string, userId: string): Promise<boolean>;
  unrefund(id: string): Promise<boolean>;
}

export async function executeLedgerRefund(
  reply: FastifyReply,
  options: {
    db: ILedgerRefundDb;
    entity: ILedgerRefundableRecord | null;
    entityId: string;
    entityName: string;
    label: string;
    notFoundError: string;
    propertyId: string;
    userId: string;
  }
): Promise<void> {
  const { db, entity, entityId, entityName, label, notFoundError, propertyId, userId } = options;

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

  const updated = await db.refund(entityId, userId);
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
