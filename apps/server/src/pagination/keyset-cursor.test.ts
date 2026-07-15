import { describe, expect, test } from "bun:test";

import {
  decodeExpenseKeysetCursor,
  decodeIncomeEntryKeysetCursor,
  decodeIncomeLineKeysetCursor,
  decodeKeysetCursor,
  decodeLeaseKeysetCursor,
  decodePropertyFavoriteKeysetCursor,
  decodeReservationKeysetCursor,
  encodeExpenseKeysetCursor,
  encodeIncomeEntryKeysetCursor,
  encodeIncomeLineKeysetCursor,
  encodeKeysetCursor,
  encodeLeaseKeysetCursor,
  encodePropertyFavoriteKeysetCursor,
  encodeReservationKeysetCursor,
} from "./keyset-cursor";

describe("encodeKeysetCursor / decodeKeysetCursor", () => {
  test("round-trips createdAt and id", () => {
    const encoded = encodeKeysetCursor(
      "2026-07-09T12:00:00.000Z",
      "550e8400-e29b-41d4-a716-446655440000"
    );
    const decoded = decodeKeysetCursor(encoded);
    expect(decoded.createdAt).toBe("2026-07-09T12:00:00.000Z");
    expect(decoded.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  test("throws on invalid cursor", () => {
    expect(() => decodeKeysetCursor("not-a-cursor")).toThrow("Invalid cursor");
  });
});

describe("encodeExpenseKeysetCursor / decodeExpenseKeysetCursor", () => {
  test("round-trips expenseDate, createdAt, and id", () => {
    const encoded = encodeExpenseKeysetCursor(
      "2026-07-09",
      "2026-07-09T12:00:00.000Z",
      "550e8400-e29b-41d4-a716-446655440000"
    );
    const decoded = decodeExpenseKeysetCursor(encoded);
    expect(decoded.expenseDate).toBe("2026-07-09");
    expect(decoded.createdAt).toBe("2026-07-09T12:00:00.000Z");
    expect(decoded.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  test("round-trips null expenseDate", () => {
    const encoded = encodeExpenseKeysetCursor(
      null,
      "2026-07-09T12:00:00.000Z",
      "550e8400-e29b-41d4-a716-446655440000"
    );
    const decoded = decodeExpenseKeysetCursor(encoded);
    expect(decoded.expenseDate).toBeNull();
  });

  test("throws on invalid cursor", () => {
    expect(() => decodeExpenseKeysetCursor("bad")).toThrow("Invalid cursor");
  });

  test("throws when expenseDate has wrong type", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        createdAt: "2026-07-09T12:00:00.000Z",
        expenseDate: 123,
        id: "550e8400-e29b-41d4-a716-446655440000",
      }),
      "utf8"
    ).toString("base64url");
    expect(() => decodeExpenseKeysetCursor(encoded)).toThrow("Invalid cursor");
  });
});

describe("encodeLeaseKeysetCursor / decodeLeaseKeysetCursor", () => {
  test("round-trips sort dimensions, createdAt, and id", () => {
    const encoded = encodeLeaseKeysetCursor({
      createdAt: "2026-07-09T12:00:00.000Z",
      id: "550e8400-e29b-41d4-a716-446655440000",
      sortBy: "start",
      sortDir: "desc",
      sortKey: "2026-07-09",
    });
    const decoded = decodeLeaseKeysetCursor(encoded);
    expect(decoded.sortBy).toBe("start");
    expect(decoded.sortDir).toBe("desc");
    expect(decoded.sortKey).toBe("2026-07-09");
    expect(decoded.createdAt).toBe("2026-07-09T12:00:00.000Z");
    expect(decoded.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  test("throws on invalid cursor", () => {
    expect(() => decodeLeaseKeysetCursor("bad")).toThrow("Invalid cursor");
  });

  test("throws when createdAt is missing", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440000",
        sortBy: "start",
        sortDir: "desc",
        sortKey: "2026-07-09",
      }),
      "utf8"
    ).toString("base64url");
    expect(() => decodeLeaseKeysetCursor(encoded)).toThrow("Invalid cursor");
  });
});

describe("encodeReservationKeysetCursor / decodeReservationKeysetCursor", () => {
  test("round-trips checkIn, createdAt, and id", () => {
    const encoded = encodeReservationKeysetCursor(
      "2026-07-09",
      "2026-07-09T12:00:00.000Z",
      "550e8400-e29b-41d4-a716-446655440000"
    );
    const decoded = decodeReservationKeysetCursor(encoded);
    expect(decoded.checkIn).toBe("2026-07-09");
    expect(decoded.createdAt).toBe("2026-07-09T12:00:00.000Z");
    expect(decoded.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  test("throws on invalid cursor", () => {
    expect(() => decodeReservationKeysetCursor("bad")).toThrow("Invalid cursor");
  });
});

describe("encodeIncomeLineKeysetCursor / decodeIncomeLineKeysetCursor", () => {
  test("round-trips transactionDate, createdAt, and id", () => {
    const encoded = encodeIncomeLineKeysetCursor(
      "2026-07-09",
      "2026-07-09T12:00:00.000Z",
      "550e8400-e29b-41d4-a716-446655440000"
    );
    const decoded = decodeIncomeLineKeysetCursor(encoded);
    expect(decoded.transactionDate).toBe("2026-07-09");
    expect(decoded.createdAt).toBe("2026-07-09T12:00:00.000Z");
    expect(decoded.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  test("throws on invalid cursor", () => {
    expect(() => decodeIncomeLineKeysetCursor("bad")).toThrow("Invalid cursor");
  });
});

describe("encodeIncomeEntryKeysetCursor / decodeIncomeEntryKeysetCursor", () => {
  test("round-trips sort dimensions, createdAt, id, and entryKind", () => {
    const encoded = encodeIncomeEntryKeysetCursor({
      createdAt: "2026-07-09T12:00:00.000Z",
      entryKind: "stay",
      id: "550e8400-e29b-41d4-a716-446655440000",
      sortBy: "date",
      sortDir: "desc",
      sortKeyDate: "2026-07-09",
      sortKeyNum: null,
      sortKeyText: null,
    });
    const decoded = decodeIncomeEntryKeysetCursor(encoded);
    expect(decoded.sortBy).toBe("date");
    expect(decoded.sortDir).toBe("desc");
    expect(decoded.sortKeyDate).toBe("2026-07-09");
    expect(decoded.sortKeyNum).toBeNull();
    expect(decoded.sortKeyText).toBeNull();
    expect(decoded.createdAt).toBe("2026-07-09T12:00:00.000Z");
    expect(decoded.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(decoded.entryKind).toBe("stay");
  });

  test("round-trips numeric sort key", () => {
    const encoded = encodeIncomeEntryKeysetCursor({
      createdAt: "2026-07-09T12:00:00.000Z",
      entryKind: "line",
      id: "550e8400-e29b-41d4-a716-446655440000",
      sortBy: "net",
      sortDir: "asc",
      sortKeyDate: null,
      sortKeyNum: 42.5,
      sortKeyText: null,
    });
    const decoded = decodeIncomeEntryKeysetCursor(encoded);
    expect(decoded.sortBy).toBe("net");
    expect(decoded.sortKeyNum).toBe(42.5);
  });

  test("throws on invalid cursor", () => {
    expect(() => decodeIncomeEntryKeysetCursor("bad")).toThrow("Invalid cursor");
  });
});

describe("encodePropertyFavoriteKeysetCursor / decodePropertyFavoriteKeysetCursor", () => {
  test("round-trips favoritedAt, createdAt, and id", () => {
    const encoded = encodePropertyFavoriteKeysetCursor(
      "2026-07-01T12:00:00.000Z",
      "2026-07-09T12:00:00.000Z",
      "550e8400-e29b-41d4-a716-446655440000"
    );
    const decoded = decodePropertyFavoriteKeysetCursor(encoded);
    expect(decoded.favoritedAt).toBe("2026-07-01T12:00:00.000Z");
    expect(decoded.createdAt).toBe("2026-07-09T12:00:00.000Z");
    expect(decoded.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  test("round-trips null favoritedAt for non-favorites", () => {
    const encoded = encodePropertyFavoriteKeysetCursor(
      null,
      "2026-07-09T12:00:00.000Z",
      "550e8400-e29b-41d4-a716-446655440000"
    );
    const decoded = decodePropertyFavoriteKeysetCursor(encoded);
    expect(decoded.favoritedAt).toBeNull();
  });

  test("throws on invalid cursor", () => {
    expect(() => decodePropertyFavoriteKeysetCursor("bad")).toThrow("Invalid cursor");
  });
});
