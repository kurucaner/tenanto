import { describe, expect, test } from "bun:test";

import {
  decodeExpenseKeysetCursor,
  decodeKeysetCursor,
  encodeExpenseKeysetCursor,
  encodeKeysetCursor,
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
