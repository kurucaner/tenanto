export function csvEscape(value: string | number): string {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function csvRow(values: Array<string | number>): string {
  return `${values.map(csvEscape).join(",")}\n`;
}
