import type { FastifyReply } from "fastify";

import { HttpStatus } from "@/packages/shared";
import { type LeaseTermsNotEditableError } from "@/services/lease-terms-edit-service";

export function replyLeaseTermsNotEditable(
  reply: FastifyReply,
  error: LeaseTermsNotEditableError
): void {
  void reply.status(HttpStatus.CONFLICT).send({
    error: error.message,
    reason: error.reason,
  });
}
