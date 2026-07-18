import { describe, expect, test } from "bun:test";
import type { FastifyReply } from "fastify";

import { leaseTermsNotEditableError } from "@/errors/lease-errors";
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
    const mock = createMockReply();
    const error = leaseTermsNotEditableError(LeaseTermsEditBlockReason.HAS_INCOME_LINES);

    replyLeaseTermsNotEditable(mock.reply, error);

    expect(mock.statusCode).toBe(HttpStatus.CONFLICT);
    expect(mock.body).toEqual({
      code: error.code,
      error: error.message,
      reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES,
    });
  });
});
