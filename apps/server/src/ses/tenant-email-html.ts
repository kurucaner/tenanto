import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "blockquote",
  "br",
  "em",
  "h1",
  "h2",
  "h3",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
  "a",
];

export function sanitizeTenantEmailHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedAttributes: {
      a: ["href", "rel", "target"],
    },
    allowedTags: ALLOWED_TAGS,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  }).trim();
}

export function tenantEmailHtmlToPlainText(html: string): string {
  const stripped = sanitizeHtml(html, {
    allowedAttributes: {},
    allowedTags: [],
  });

  return stripped
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
