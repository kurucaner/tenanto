import type { FastifyReply } from "fastify";

import {
  getPostgresErrorMeta,
  isPostgresForeignKeyViolation,
  isPostgresUniqueViolation,
} from "@/db/pg-errors";
import { getConstraintErrorCode, getConstraintMessage } from "@/db/postgres-constraint-messages";
import { HttpStatus } from "@/packages/shared";

const DEFAULT_DUPLICATE_MESSAGE = "This value already exists";
const DEFAULT_FOREIGN_KEY_MESSAGE =
  "This record cannot be deleted because other data depends on it";

export interface IReplyFromDatabaseErrorOptions {
  duplicateMessage?: string;
  foreignKeyFallback?: string;
}

export function replyFromDatabaseError(
  reply: FastifyReply,
  error: unknown,
  options: IReplyFromDatabaseErrorOptions = {}
): boolean {
  if (isPostgresUniqueViolation(error)) {
    const meta = getPostgresErrorMeta(error);
    const message =
      options.duplicateMessage ??
      getConstraintMessage(meta?.constraint ?? null, DEFAULT_DUPLICATE_MESSAGE);
    const code = getConstraintErrorCode(meta?.constraint ?? null);
    void reply
      .status(HttpStatus.CONFLICT)
      .send(code === undefined ? { error: message } : { code, error: message });
    return true;
  }

  if (isPostgresForeignKeyViolation(error)) {
    const meta = getPostgresErrorMeta(error);
    const message = getConstraintMessage(
      meta?.constraint ?? null,
      options.foreignKeyFallback ?? DEFAULT_FOREIGN_KEY_MESSAGE
    );
    const code = getConstraintErrorCode(meta?.constraint ?? null);
    void reply
      .status(HttpStatus.CONFLICT)
      .send(code === undefined ? { error: message } : { code, error: message });
    return true;
  }

  return false;
}
