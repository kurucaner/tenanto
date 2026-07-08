import type { FastifyReply } from "fastify";

import { HttpStatus } from "@/packages/shared";

export function rejectIfDeleted(
  entity: { isDeleted: boolean },
  reply: FastifyReply,
  label: string
): boolean {
  if (!entity.isDeleted) return false;
  void reply.status(HttpStatus.CONFLICT).send({ error: `Cannot modify a deleted ${label}` });
  return true;
}
