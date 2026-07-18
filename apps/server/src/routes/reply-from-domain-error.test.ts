import { describe, expect, test } from "bun:test";
import type { FastifyReply } from "fastify";

import { DomainError } from "@/lib/domain-error";
import { HttpStatus } from "@/packages/shared";

import { replyFromDomainError } from "./reply-from-domain-error";

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

describe("replyFromDomainError", () => {
  test("sends code, message, and merged body for DomainError", () => {
    const mock = createMockReply();
    const handled = replyFromDomainError(
      mock.reply,
      new DomainError("PORTAL_INVITE_NOT_FOUND", "Portal invite not found", HttpStatus.NOT_FOUND, {
        retryable: false,
      })
    );

    expect(handled).toBe(true);
    expect(mock.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(mock.body).toEqual({
      code: "PORTAL_INVITE_NOT_FOUND",
      error: "Portal invite not found",
      retryable: false,
    });
  });

  test("returns false for unrelated errors", () => {
    const mock = createMockReply();
    const handled = replyFromDomainError(mock.reply, new Error("boom"));

    expect(handled).toBe(false);
    expect(mock.statusCode).toBe(0);
    expect(mock.body).toBeUndefined();
  });
});
