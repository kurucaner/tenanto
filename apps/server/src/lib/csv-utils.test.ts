import { describe, expect, test } from "bun:test";

import { csvEscape, csvRow } from "./csv-utils";

describe("csvEscape", () => {
  test("returns plain values unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
  });

  test("quotes values with commas, quotes, or newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("csvRow", () => {
  test("joins escaped values with commas and trailing newline", () => {
    expect(csvRow(["Date", "Amount"])).toBe("Date,Amount\n");
    expect(csvRow(["Maintenance, LLC", 12.5])).toBe('"Maintenance, LLC",12.5\n');
  });
});
