import type { FastifyReply } from "fastify";

import { HttpStatus, UserType } from "@/packages/shared";

export function parseOptionalListCursor(query: Record<string, unknown>): string | undefined {
  return typeof query["cursor"] === "string" && query["cursor"] !== ""
    ? query["cursor"]
    : undefined;
}

export function validateKeysetCursor(
  cursor: string | undefined,
  decode: (raw: string) => unknown
): { error: string; ok: false } | { ok: true } {
  if (cursor == null) {
    return { ok: true };
  }
  try {
    decode(cursor);
    return { ok: true };
  } catch {
    return { error: "Invalid cursor", ok: false };
  }
}

export function shouldIncludeDeletedListItems(userType: string): boolean {
  return userType === UserType.ADMIN;
}

export function sendInvalidCursor(reply: FastifyReply): void {
  void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
}

export function buildPaginatedListResponse<TItem, TMeta>(
  itemsKey: string,
  items: TItem[],
  meta: TMeta | undefined,
  nextCursor: string | null | undefined
): Record<string, unknown> {
  return meta != null ? { [itemsKey]: items, meta, nextCursor } : { [itemsKey]: items, nextCursor };
}
