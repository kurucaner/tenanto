import type { FastifyReply } from "fastify";

import { HttpStatus } from "@/packages/shared";

export function isRefunded(entity: { refundedAt: string | null }): boolean {
  return entity.refundedAt !== null;
}

export function rejectIfRefunded(
  entity: { refundedAt: string | null },
  reply: FastifyReply,
  label: string
): boolean {
  if (!isRefunded(entity)) return false;
  void reply.status(HttpStatus.CONFLICT).send({ error: `Cannot modify a refunded ${label}` });
  return true;
}
