export function htmlToPlainText(html: string): string {
  let plain = "";
  let inTag = false;

  for (const char of html) {
    if (char === "<") {
      inTag = true;
      continue;
    }
    if (char === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) {
      plain += char;
    }
  }

  return plain.trim();
}

export function hasRichTextContent(html: string): boolean {
  return htmlToPlainText(html).length > 0;
}
