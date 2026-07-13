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
