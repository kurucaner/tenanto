import { describe, expect, test } from "bun:test";
import type { FastifyReply } from "fastify";

import { HttpStatus, LeaseTermsEditBlockReason } from "@/packages/shared";

import { replyLeaseTermsNotEditable } from "./reply-lease-terms-not-editable";

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

describe("replyLeaseTermsNotEditable", () => {
  test("returns 409 with error message and block reason", async () => {
    const { LeaseTermsNotEditableError } = await import("@/services/lease-terms-edit-service");
    const mock = createMockReply();
    const error = new LeaseTermsNotEditableError(LeaseTermsEditBlockReason.HAS_INCOME_LINES);

    replyLeaseTermsNotEditable(mock.reply, error);

    expect(mock.statusCode).toBe(HttpStatus.CONFLICT);
    expect(mock.body).toEqual({
      error: error.message,
      reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES,
    });
  });
});
