import type { FastifyReply } from "fastify";

import { isDomainError } from "@/lib/domain-error";

export function replyFromDomainError(reply: FastifyReply, error: unknown): boolean {
  if (!isDomainError(error)) {
    return false;
  }

  const payload =
    error.body === undefined
      ? { code: error.code, error: error.message }
      : { code: error.code, error: error.message, ...error.body };

  void reply.status(error.httpStatus).send(payload);
  return true;
}
