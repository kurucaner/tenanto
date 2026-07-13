import { describe, expect, mock, test } from "bun:test";

import { HttpStatus } from "@/packages/shared";

import {
  executeLedgerRefund,
  executeLedgerUnrefund,
  type ILedgerRefundableRecord,
} from "./ledger-refund-route-actions";

function makeReply() {
  const send = mock((_payload: unknown) => undefined);
  const status = mock((_code: number) => ({ send }));
  return { reply: { status } as never, send, status };
}

function makeEntity(overrides: Partial<ILedgerRefundableRecord> = {}): ILedgerRefundableRecord {
  return {
    isDeleted: false,
    propertyId: "prop-1",
    refundedAt: null,
    ...overrides,
  };
}

const baseRefundOptions = {
  entityId: "entry-1",
  entityName: "Reservation",
  label: "reservation",
  notFoundError: "Reservation not found",
  propertyId: "prop-1",
  refundableCap: 500,
  userId: "user-1",
};

describe("executeLedgerRefund", () => {
  test("returns 404 when entity is missing", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: null,
      ...baseRefundOptions,
    });

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(send).toHaveBeenCalledWith({ error: "Reservation not found" });
    expect(refund).not.toHaveBeenCalled();
  });

  test("returns 400 when entity is deleted", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: makeEntity({ isDeleted: true }),
      ...baseRefundOptions,
    });

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith({ error: "Cannot refund a deleted reservation" });
    expect(refund).not.toHaveBeenCalled();
  });

  test("returns 409 when entity is already refunded", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: makeEntity({ refundedAt: "2026-03-01T00:00:00.000Z" }),
      ...baseRefundOptions,
    });

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith({ error: "Reservation is already refunded" });
    expect(refund).not.toHaveBeenCalled();
  });

  test("returns 400 when partial amount exceeds cap", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      body: { amount: 500.01 },
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: makeEntity(),
      ...baseRefundOptions,
    });

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith({ error: "amount cannot exceed 500" });
    expect(refund).not.toHaveBeenCalled();
  });

  test("returns 400 when partial amount is zero", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      body: { amount: 0 },
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: makeEntity(),
      ...baseRefundOptions,
    });

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith({ error: "amount must be greater than zero" });
    expect(refund).not.toHaveBeenCalled();
  });

  test("refunds full amount and returns 204 when body is omitted", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: makeEntity(),
      ...baseRefundOptions,
    });

    expect(refund).toHaveBeenCalledWith("entry-1", "user-1", 500);
    expect(status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
    expect(send).toHaveBeenCalledWith();
  });

  test("refunds partial amount and returns 204", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      body: { amount: 125 },
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: makeEntity(),
      ...baseRefundOptions,
    });

    expect(refund).toHaveBeenCalledWith("entry-1", "user-1", 125);
    expect(status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
    expect(send).toHaveBeenCalledWith();
  });
});

describe("executeLedgerUnrefund", () => {
  test("returns 409 when entity is not refunded", async () => {
    const { reply, send, status } = makeReply();
    const unrefund = mock(() => Promise.resolve(true));

    await executeLedgerUnrefund(reply, {
      db: { refund: mock(() => Promise.resolve(true)), unrefund },
      entity: makeEntity(),
      entityId: "entry-1",
      entityName: "Income line",
      notFoundError: "Income line not found",
      propertyId: "prop-1",
    });

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith({ error: "Income line is not refunded" });
    expect(unrefund).not.toHaveBeenCalled();
  });

  test("unrefunds and returns 204 on success", async () => {
    const { reply, send, status } = makeReply();
    const unrefund = mock(() => Promise.resolve(true));

    await executeLedgerUnrefund(reply, {
      db: { refund: mock(() => Promise.resolve(true)), unrefund },
      entity: makeEntity({ refundedAt: "2026-03-01T00:00:00.000Z" }),
      entityId: "entry-1",
      entityName: "Income line",
      notFoundError: "Income line not found",
      propertyId: "prop-1",
    });

    expect(unrefund).toHaveBeenCalledWith("entry-1");
    expect(status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
    expect(send).toHaveBeenCalledWith();
  });
});
