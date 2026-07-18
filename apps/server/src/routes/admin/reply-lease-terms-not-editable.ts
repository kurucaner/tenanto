import type { FastifyReply } from "fastify";

import { type DomainError } from "@/lib/domain-error";
import { replyFromDomainError } from "@/routes/reply-from-domain-error";

export function replyLeaseTermsNotEditable(reply: FastifyReply, error: DomainError): FastifyReply {
  if (replyFromDomainError(reply, error)) {
    return reply;
  }
  throw error;
}
