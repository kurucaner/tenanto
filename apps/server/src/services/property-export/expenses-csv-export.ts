import { Readable } from "node:stream";

import { propertyExpensesDb } from "@/db/property-expenses";
import { csvRow } from "@/lib/csv-utils";
import { PROPERTY_EXPORT_BATCH_SIZE } from "@/lib/property-export-config";
import {
  type IPropertyExpense,
  PROPERTY_EXPORT_MAX_ROWS,
  type TPropertyExpensesListFilters,
} from "@/packages/shared";

export class ExportRowLimitExceededError extends Error {
  readonly matchedCount: number;

  constructor(matchedCount: number, maxRows: number) {
    super(
      `Export exceeded the maximum of ${maxRows.toLocaleString()} rows (found ${matchedCount.toLocaleString()}). Narrow your date range or filters and try again.`
    );
    this.name = "ExportRowLimitExceededError";
    this.matchedCount = matchedCount;
  }
}

const EXPENSE_CSV_HEADERS = [
  "Date",
  "Category",
  "Description",
  "Amount",
  "Tax-free",
  "Created at",
] as const;

function formatExpenseDate(value: string | null): string {
  return value ?? "";
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

function formatTaxFree(taxFree: boolean): string {
  return taxFree ? "Yes" : "No";
}

function formatCreatedAt(value: string): string {
  return value.slice(0, 10);
}

export function mapExpenseToCsvValues(expense: IPropertyExpense): string[] {
  return [
    formatExpenseDate(expense.expenseDate),
    expense.categoryName,
    expense.description ?? "",
    formatMoney(expense.amount),
    formatTaxFree(expense.taxFree),
    formatCreatedAt(expense.createdAt),
  ];
}

export function buildExpensesExportFileName(
  filters: TPropertyExpensesListFilters,
  format: "csv" | "xlsx" = "csv"
): string {
  const from = filters.from ?? "all";
  const to = filters.to ?? "all";
  return `expenses-${from}-${to}.${format}`;
}

export async function* iterateExpenseExportRows(
  propertyId: string,
  filters: TPropertyExpensesListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): AsyncGenerator<(string | number | null)[]> {
  yield [...EXPENSE_CSV_HEADERS];

  let cursor: string | undefined;
  let rowCount = 0;

  for (;;) {
    const page = await propertyExpensesDb.listPaginatedPage(propertyId, filters, {
      cursor,
      limit: PROPERTY_EXPORT_BATCH_SIZE,
    });

    for (const expense of page.expenses) {
      rowCount += 1;
      if (rowCount > maxRows) {
        throw new ExportRowLimitExceededError(rowCount, maxRows);
      }
      yield mapExpenseToCsvValues(expense);
    }

    if (page.nextCursor == null) {
      break;
    }
    cursor = page.nextCursor;
  }
}

export async function* iterateExpenseExportCsvChunks(
  propertyId: string,
  filters: TPropertyExpensesListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): AsyncGenerator<string> {
  for await (const row of iterateExpenseExportRows(propertyId, filters, maxRows)) {
    yield csvRow(row.map((value) => (value == null ? "" : String(value))));
  }
}

export async function collectExpensesCsvExport(
  propertyId: string,
  filters: TPropertyExpensesListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): Promise<{ csv: string; rowCount: number }> {
  const parts: string[] = [];
  let rowCount = 0;
  let isHeader = true;

  for await (const chunk of iterateExpenseExportCsvChunks(propertyId, filters, maxRows)) {
    parts.push(chunk);
    if (!isHeader) {
      rowCount += 1;
    }
    isHeader = false;
  }

  return { csv: parts.join(""), rowCount };
}

export function createExpensesCsvReadable(
  propertyId: string,
  filters: TPropertyExpensesListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): Readable {
  return Readable.from(iterateExpenseExportCsvChunks(propertyId, filters, maxRows), {
    encoding: "utf8",
  });
}
