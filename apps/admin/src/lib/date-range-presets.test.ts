import { describe, expect, test } from "bun:test";

import {
  DateRangePreset,
  matchDateRangePreset,
  resolveDateRangePreset,
} from "./date-range-presets";

const NOW = new Date("2026-07-15T12:00:00.000Z");

describe("resolveDateRangePreset", () => {
  test("resolves each preset", () => {
    expect(resolveDateRangePreset(DateRangePreset.CURRENT_MONTH, NOW)).toEqual({
      from: "2026-07-01",
      to: "2026-07-15",
    });
    expect(resolveDateRangePreset(DateRangePreset.YEAR_TO_DATE, NOW)).toEqual({
      from: "2026-01-01",
      to: "2026-07-15",
    });
    expect(resolveDateRangePreset(DateRangePreset.DAY, NOW)).toEqual({
      from: "2026-07-15",
      to: "2026-07-15",
    });
    expect(resolveDateRangePreset(DateRangePreset.WEEK, NOW)).toEqual({
      from: "2026-07-09",
      to: "2026-07-15",
    });
    expect(resolveDateRangePreset(DateRangePreset.MONTH, NOW)).toEqual({
      from: "2026-06-16",
      to: "2026-07-15",
    });
    expect(resolveDateRangePreset(DateRangePreset.SIX_MONTHS, NOW)).toEqual({
      from: "2026-01-17",
      to: "2026-07-15",
    });
    expect(resolveDateRangePreset(DateRangePreset.YEAR, NOW)).toEqual({
      from: "2025-07-16",
      to: "2026-07-15",
    });
    expect(resolveDateRangePreset(DateRangePreset.ALL, NOW)).toBeNull();
  });
});

describe("matchDateRangePreset", () => {
  test("matches resolved presets", () => {
    for (const id of [
      DateRangePreset.CURRENT_MONTH,
      DateRangePreset.YEAR_TO_DATE,
      DateRangePreset.DAY,
      DateRangePreset.WEEK,
      DateRangePreset.MONTH,
      DateRangePreset.SIX_MONTHS,
      DateRangePreset.YEAR,
    ] as const) {
      const resolved = resolveDateRangePreset(id, NOW);
      expect(resolved).not.toBeNull();
      expect(matchDateRangePreset(resolved!.from, resolved!.to, NOW)).toBe(id);
    }
  });

  test("matches all time when both dates are empty", () => {
    expect(matchDateRangePreset("", "", NOW)).toBe(DateRangePreset.ALL);
  });

  test("returns null for custom ranges", () => {
    expect(matchDateRangePreset("2026-07-01", "2026-07-10", NOW)).toBeNull();
    expect(matchDateRangePreset("2026-07-01", "", NOW)).toBeNull();
  });
});
