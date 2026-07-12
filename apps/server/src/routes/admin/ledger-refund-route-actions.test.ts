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

describe("executeLedgerRefund", () => {
  test("returns 404 when entity is missing", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: null,
      entityId: "entry-1",
      entityName: "Reservation",
      label: "reservation",
      notFoundError: "Reservation not found",
      propertyId: "prop-1",
      userId: "user-1",
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
      entityId: "entry-1",
      entityName: "Reservation",
      label: "reservation",
      notFoundError: "Reservation not found",
      propertyId: "prop-1",
      userId: "user-1",
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
      entityId: "entry-1",
      entityName: "Reservation",
      label: "reservation",
      notFoundError: "Reservation not found",
      propertyId: "prop-1",
      userId: "user-1",
    });

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith({ error: "Reservation is already refunded" });
    expect(refund).not.toHaveBeenCalled();
  });

  test("refunds and returns 204 on success", async () => {
    const { reply, send, status } = makeReply();
    const refund = mock(() => Promise.resolve(true));

    await executeLedgerRefund(reply, {
      db: { refund, unrefund: mock(() => Promise.resolve(true)) },
      entity: makeEntity(),
      entityId: "entry-1",
      entityName: "Reservation",
      label: "reservation",
      notFoundError: "Reservation not found",
      propertyId: "prop-1",
      userId: "user-1",
    });

    expect(refund).toHaveBeenCalledWith("entry-1", "user-1");
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
