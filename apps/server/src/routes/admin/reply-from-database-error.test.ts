import { describe, expect, test } from "bun:test";
import type { FastifyReply } from "fastify";

import { HttpStatus } from "@/packages/shared";
import { replyFromDatabaseError } from "@/routes/admin/reply-from-database-error";

function createMockReply(): {
  body: unknown;
  reply: FastifyReply;
  statusCode: number;
} {
  const state = { body: undefined as unknown, statusCode: 0 };
  const reply = {
    send(payload: unknown) {
      state.body = payload;
      return reply;
    },
    status(code: number) {
      state.statusCode = code;
      return reply;
    },
  } as FastifyReply;

  return {
    get body() {
      return state.body;
    },
    reply,
    get statusCode() {
      return state.statusCode;
    },
  };
}

describe("replyFromDatabaseError", () => {
  test("handles unique violation with duplicate override", () => {
    const mock = createMockReply();
    const handled = replyFromDatabaseError(mock.reply, { code: "23505" }, {
      duplicateMessage: "Custom duplicate message",
    });

    expect(handled).toBe(true);
    expect(mock.statusCode).toBe(HttpStatus.CONFLICT);
    expect(mock.body).toEqual({ error: "Custom duplicate message" });
  });

  test("handles foreign key violation with constraint message and code", () => {
    const mock = createMockReply();
    const handled = replyFromDatabaseError(
      mock.reply,
      {
        code: "23503",
        constraint: "property_reservations_unit_id_fkey",
      },
      { foreignKeyFallback: "Generic FK fallback" }
    );

    expect(handled).toBe(true);
    expect(mock.statusCode).toBe(HttpStatus.CONFLICT);
    expect(mock.body).toEqual({
      code: "UNIT_HAS_RESERVATIONS",
      error: "This unit cannot be deleted because it has reservation records",
    });
  });

  test("returns false for unrelated errors", () => {
    const mock = createMockReply();
    const handled = replyFromDatabaseError(mock.reply, new Error("boom"));

    expect(handled).toBe(false);
    expect(mock.statusCode).toBe(0);
    expect(mock.body).toBeUndefined();
  });
});
