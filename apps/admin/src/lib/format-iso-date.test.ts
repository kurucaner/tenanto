import { describe, expect, test } from "bun:test";

import { formatIsoDateDisplay } from "./format-iso-date";

describe("formatIsoDateDisplay", () => {
  test("formats YYYY-MM-DD as mm/dd/yyyy", () => {
    expect(formatIsoDateDisplay("2026-07-09")).toBe("07/09/2026");
  });
});
