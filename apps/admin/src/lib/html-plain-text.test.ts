import { describe, expect, test } from "bun:test";

import { hasRichTextContent, htmlToPlainText } from "./html-plain-text";

describe("htmlToPlainText", () => {
  test("strips tags and trims whitespace", () => {
    expect(htmlToPlainText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
    expect(htmlToPlainText("<p></p>")).toBe("");
    expect(htmlToPlainText("  plain  ")).toBe("plain");
  });
});

describe("hasRichTextContent", () => {
  test("detects readable content", () => {
    expect(hasRichTextContent("<p>Hi</p>")).toBe(true);
    expect(hasRichTextContent("<p></p>")).toBe(false);
    expect(hasRichTextContent("<p>   </p>")).toBe(false);
  });
});
