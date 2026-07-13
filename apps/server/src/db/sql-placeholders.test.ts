import { describe, expect, test } from "bun:test";

import { offsetSqlPlaceholders } from "./sql-placeholders";

describe("offsetSqlPlaceholders", () => {
  test("returns sql unchanged when offset is zero", () => {
    expect(offsetSqlPlaceholders("WHERE id = $1 AND name = $2", 0)).toBe(
      "WHERE id = $1 AND name = $2"
    );
  });

  test("offsets positional placeholders without colliding on multi-digit indexes", () => {
    expect(offsetSqlPlaceholders("WHERE id = $1 AND other = $10", 3)).toBe(
      "WHERE id = $4 AND other = $13"
    );
  });
});
