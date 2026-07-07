import * as fs from "node:fs";
import * as path from "node:path";

const TEMPLATES_DIR = path.join(__dirname, "..", "..", "templates");

const templateCache = new Map<string, string>();

function loadTemplate(name: string): string {
  const cached = templateCache.get(name);
  if (cached) return cached;

  const filePath = path.join(TEMPLATES_DIR, name);
  const content = fs.readFileSync(filePath, "utf-8");
  templateCache.set(name, content);
  return content;
}

export function renderTemplate(name: string, vars: Record<string, string>): string {
  let html = loadTemplate(name);
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}
