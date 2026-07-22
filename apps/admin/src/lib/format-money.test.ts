import { describe, expect, test } from "bun:test";

import { formatMoney } from "./format-money";

describe("formatMoney", () => {
  test("omits trailing .00 for whole dollars", () => {
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(1500)).toBe("$1,500");
    expect(formatMoney(1750)).toBe("$1,750");
  });

  test("keeps two fraction digits when cents are present", () => {
    expect(formatMoney(0.01)).toBe("$0.01");
    expect(formatMoney(1500.5)).toBe("$1,500.50");
    expect(formatMoney(1750.01)).toBe("$1,750.01");
  });
});
