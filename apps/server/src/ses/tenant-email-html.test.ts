import { describe, expect, test } from "bun:test";

import { sanitizeTenantEmailHtml, tenantEmailHtmlToPlainText } from "./tenant-email-html";

describe("sanitizeTenantEmailHtml", () => {
  test("strips script tags and unsafe attributes", () => {
    const html = sanitizeTenantEmailHtml(
      '<p>Hello</p><script>alert("x")</script><img src=x onerror=alert(1) />'
    );

    expect(html).toBe("<p>Hello</p>");
  });

  test("keeps basic formatting tags", () => {
    const html = sanitizeTenantEmailHtml(
      '<p><strong>Hi</strong> <a href="https://example.com">link</a></p>'
    );

    expect(html).toContain("<strong>Hi</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe("tenantEmailHtmlToPlainText", () => {
  test("converts html to readable plain text", () => {
    const text = tenantEmailHtmlToPlainText("<p>Hello<br/>World</p>");

    expect(text).toBe("HelloWorld");
  });
});
