import { type IExpenseCsvExtractedRow } from "@/packages/shared";

const CHASE_HEADERS = [
  "card",
  "transaction date",
  "post date",
  "description",
  "category",
  "type",
  "amount",
  "memo",
] as const;

const DATE_HEADER_PATTERNS = [/date/i, /posted/i, /posting/i];
const AMOUNT_HEADER_PATTERNS = [/amount/i, /debit/i, /charge/i, /total/i];
const DESCRIPTION_HEADER_PATTERNS = [
  /description/i,
  /memo/i,
  /details/i,
  /narrative/i,
  /merchant/i,
];

export type TExpenseCsvExtractResult =
  { error: string } | { ok: true; rows: IExpenseCsvExtractedRow[] };

export function extractExpenseRowsFromCsv(
  csvText: string,
  sourceFileName: string
): TExpenseCsvExtractResult {
  const parsed = parseCsvRecords(csvText);
  if (parsed.length === 0) {
    return { error: "The file is empty." };
  }

  const [headerRow, ...dataRows] = parsed;
  if (!headerRow || headerRow.length === 0) {
    return { error: "The file is empty." };
  }

  const normalizedHeaders = headerRow.map((header) => header.trim().toLowerCase());
  if (isChaseFormat(normalizedHeaders)) {
    return extractChaseRows(dataRows, normalizedHeaders, sourceFileName);
  }

  return extractGenericRows(dataRows, normalizedHeaders, sourceFileName);
}

function isChaseFormat(headers: string[]): boolean {
  return CHASE_HEADERS.every((header, index) => headers[index] === header);
}

function extractChaseRows(
  dataRows: string[][],
  headers: string[],
  sourceFileName: string
): TExpenseCsvExtractResult {
  const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  const rows: IExpenseCsvExtractedRow[] = [];

  for (const [index, cells] of dataRows.entries()) {
    const type = getCell(cells, columnIndex["type"])?.trim() ?? "";
    const rawAmount = parseMoney(getCell(cells, columnIndex["amount"]));
    if (type !== "Sale" || rawAmount === null || rawAmount >= 0) {
      continue;
    }

    const description = getCell(cells, columnIndex["description"])?.trim() ?? "";
    const bankCategory = getCell(cells, columnIndex["category"])?.trim();
    const composedDescription = bankCategory ? `${description} (${bankCategory})` : description;

    rows.push({
      amount: Math.abs(rawAmount),
      bankCategory: bankCategory || undefined,
      bankType: type,
      description: composedDescription,
      expenseDate: parseUsDateToIso(getCell(cells, columnIndex["post date"])),
      rowIndex: index + 1,
      sourceFileName,
    });
  }

  return { ok: true, rows };
}

function extractGenericRows(
  dataRows: string[][],
  headers: string[],
  sourceFileName: string
): TExpenseCsvExtractResult {
  const dateIndex = findColumnIndex(headers, DATE_HEADER_PATTERNS);
  const amountIndex = findColumnIndex(headers, AMOUNT_HEADER_PATTERNS);
  const descriptionIndex = findColumnIndex(headers, DESCRIPTION_HEADER_PATTERNS);

  if (dateIndex === -1 || amountIndex === -1 || descriptionIndex === -1) {
    return { error: "Unrecognized CSV format" };
  }

  const chargeSign = detectChargeSignConvention(dataRows, amountIndex);
  const rows: IExpenseCsvExtractedRow[] = [];

  for (const [index, cells] of dataRows.entries()) {
    const rawAmount = parseMoney(getCell(cells, amountIndex));
    if (rawAmount === null || rawAmount === 0) {
      continue;
    }

    if (!isChargeAmount(rawAmount, chargeSign)) {
      continue;
    }

    const description = getCell(cells, descriptionIndex)?.trim() ?? "";
    if (description === "") {
      continue;
    }

    rows.push({
      amount: Math.abs(rawAmount),
      description,
      expenseDate: parseFlexibleDateToIso(getCell(cells, dateIndex)),
      rowIndex: index + 1,
      sourceFileName,
    });
  }

  return { ok: true, rows };
}

function detectChargeSignConvention(
  dataRows: string[][],
  amountIndex: number
): "negative" | "positive" {
  let negativeCount = 0;
  let positiveCount = 0;

  for (const cells of dataRows.slice(0, 20)) {
    const amount = parseMoney(getCell(cells, amountIndex));
    if (amount === null || amount === 0) {
      continue;
    }
    if (amount < 0) {
      negativeCount += 1;
    } else {
      positiveCount += 1;
    }
  }

  return negativeCount >= positiveCount ? "negative" : "positive";
}

function isChargeAmount(amount: number, chargeSign: "negative" | "positive"): boolean {
  return chargeSign === "negative" ? amount < 0 : amount > 0;
}

function findColumnIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function getCell(cells: string[], index: number | undefined): string | undefined {
  if (index === undefined || index < 0) {
    return undefined;
  }
  return cells[index];
}

function parseMoney(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }
  const normalized = raw.trim().replace(/[$,]/g, "");
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUsDateToIso(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!match) {
    return undefined;
  }
  const month = match[1]?.padStart(2, "0");
  const day = match[2]?.padStart(2, "0");
  const year = match[3];
  if (!month || !day || !year) {
    return undefined;
  }
  return `${year}-${month}-${day}`;
}

function parseFlexibleDateToIso(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  const usDate = parseUsDateToIso(trimmed);
  if (usDate) {
    return usDate;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

function finalizeCsvRecord(
  records: string[][],
  currentRecord: string[],
  currentField: string
): { currentField: string; currentRecord: string[] } {
  const record = [...currentRecord, currentField];
  if (record.some((field) => field.trim() !== "")) {
    records.push(record);
  }
  return { currentField: "", currentRecord: [] };
}

function handleQuotedCsvChar(
  char: string,
  nextChar: string | undefined,
  currentField: string
): { currentField: string; indexOffset: number } | "close-quote" {
  if (char === '"' && nextChar === '"') {
    return { currentField: `${currentField}"`, indexOffset: 1 };
  }
  if (char === '"') {
    return "close-quote";
  }
  return { currentField: `${currentField}${char}`, indexOffset: 0 };
}

export function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index] ?? "";
    const nextChar = csvText[index + 1];

    if (inQuotes) {
      const quoted = handleQuotedCsvChar(char, nextChar, currentField);
      if (quoted === "close-quote") {
        inQuotes = false;
        continue;
      }
      currentField = quoted.currentField;
      index += quoted.indexOffset;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      currentRecord.push(currentField);
      currentField = "";
      continue;
    }
    if (char === "\n") {
      ({ currentField, currentRecord } = finalizeCsvRecord(records, currentRecord, currentField));
      continue;
    }
    if (char === "\r") {
      continue;
    }

    currentField += char;
  }

  finalizeCsvRecord(records, currentRecord, currentField);
  return records;
}
