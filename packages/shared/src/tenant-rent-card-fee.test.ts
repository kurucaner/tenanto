import { describe, expect, test } from "bun:test";

import {
  computeRentCardConvenienceFeeCents,
  RENT_CARD_CONVENIENCE_FEE_FIXED_CENTS,
  RENT_CARD_CONVENIENCE_FEE_RATE,
} from "./tenant-rent-card-fee";

describe("computeRentCardConvenienceFeeCents", () => {
  test("returns 0 for $0 rent", () => {
    expect(computeRentCardConvenienceFeeCents(0)).toBe(0);
  });

  test("returns 0 for negative or non-integer rent", () => {
    expect(computeRentCardConvenienceFeeCents(-100)).toBe(0);
    expect(computeRentCardConvenienceFeeCents(12.5)).toBe(0);
    expect(computeRentCardConvenienceFeeCents(Number.NaN)).toBe(0);
  });

  test("applies fixed $0.30 on small positive rent", () => {
    // 1¢ × 2.9% rounds to 0 → fee is fixed only
    expect(computeRentCardConvenienceFeeCents(1)).toBe(RENT_CARD_CONVENIENCE_FEE_FIXED_CENTS);
  });

  test("typical rent ~$1,500 → 2.9% + $0.30", () => {
    const rentCents = 150_000;
    const expected =
      Math.round(rentCents * RENT_CARD_CONVENIENCE_FEE_RATE) +
      RENT_CARD_CONVENIENCE_FEE_FIXED_CENTS;
    expect(computeRentCardConvenienceFeeCents(rentCents)).toBe(expected);
    expect(computeRentCardConvenienceFeeCents(rentCents)).toBe(4_380);
  });

  test("rounds percent component to nearest cent", () => {
    // 100 cents × 0.029 = 2.9 → rounds to 3 + 30 = 33
    expect(computeRentCardConvenienceFeeCents(100)).toBe(33);
  });
});
