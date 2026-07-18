import { Readable } from "node:stream";

import { propertyIncomeEntriesDb } from "@/db/property-income-entries";
import { propertyUnitsDb } from "@/db/property-units";
import { exportRowLimitExceededError } from "@/errors/export-errors";
import { csvRow } from "@/lib/csv-utils";
import { PROPERTY_EXPORT_BATCH_SIZE } from "@/lib/property-export-config";
import {
  getStayNetPayout,
  getStayTaxesTotal,
  IncomeEntryKind,
  type IPropertyIncomeLine,
  type IPropertyReservation,
  PROPERTY_AMENITY_UNIT_LABEL,
  PROPERTY_EXPORT_MAX_ROWS,
  type TPropertyIncomeEntriesListFilters,
  type TPropertyIncomeEntry,
} from "@/packages/shared";

import { type TExportSpreadsheetRow, uploadXlsxFromRowIterator } from "./property-export-xlsx";

const INCOME_EXPORT_HEADERS = [
  "Type",
  "Unit",
  "Guest",
  "Date",
  "Check-out",
  "Nights",
  "Channel",
  "Status",
  "Room total",
  "Cleaning",
  "Taxes",
  "Commission",
  "Gross",
  "Net Payout",
  "Net",
] as const;

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

function resolveUnitLabel(
  unitId: string | null | undefined,
  unitLabelById: Map<string, string>
): string {
  if (unitId == null || unitId === "") {
    return PROPERTY_AMENITY_UNIT_LABEL;
  }
  return unitLabelById.get(unitId) ?? unitId;
}

function mapStayToExportRow(
  stay: IPropertyReservation,
  unitLabelById: Map<string, string>
): TExportSpreadsheetRow {
  return [
    "Stay",
    resolveUnitLabel(stay.unitId, unitLabelById),
    stay.guestName,
    stay.checkIn,
    stay.checkOut,
    stay.nights,
    stay.channelName,
    stay.status,
    formatMoney(stay.roomTotal),
    formatMoney(stay.cleaningFee),
    formatMoney(getStayTaxesTotal(stay)),
    formatMoney(stay.channelCommission),
    formatMoney(stay.grossIncome),
    formatMoney(getStayNetPayout(stay)),
    formatMoney(stay.netIncome),
  ];
}

function mapLineToExportRow(
  line: IPropertyIncomeLine,
  unitLabelById: Map<string, string>
): TExportSpreadsheetRow {
  return [
    line.incomeLineTypeName ?? line.incomeLineTypeId,
    resolveUnitLabel(line.unitId, unitLabelById),
    line.guestName ?? "",
    line.transactionDate,
    "",
    "",
    "",
    "",
    formatMoney(line.amount),
    "",
    "",
    formatMoney(line.channelCommission),
    formatMoney(line.grossIncome),
    "",
    formatMoney(line.netIncome),
  ];
}

function mapIncomeEntryToExportRow(
  entry: TPropertyIncomeEntry,
  unitLabelById: Map<string, string>
): TExportSpreadsheetRow {
  if (entry.entryKind === IncomeEntryKind.STAY) {
    return mapStayToExportRow(entry.stay, unitLabelById);
  }
  return mapLineToExportRow(entry.line, unitLabelById);
}

export function buildIncomeExportFileName(
  filters: TPropertyIncomeEntriesListFilters,
  format: "csv" | "xlsx" = "csv"
): string {
  const from = filters.from ?? "all";
  const to = filters.to ?? "all";
  return `income-${from}-${to}.${format}`;
}

async function buildUnitLabelMap(propertyId: string): Promise<Map<string, string>> {
  const units = await propertyUnitsDb.findByProperty(propertyId, false);
  return new Map(units.map((unit) => [unit.id, unit.unitNumber]));
}

export async function* iterateIncomeExportRows(
  propertyId: string,
  filters: TPropertyIncomeEntriesListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): AsyncGenerator<TExportSpreadsheetRow> {
  const unitLabelById = await buildUnitLabelMap(propertyId);
  yield [...INCOME_EXPORT_HEADERS];

  let cursor: string | undefined;
  let rowCount = 0;

  for (;;) {
    const page = await propertyIncomeEntriesDb.listPaginatedPage(propertyId, filters, {
      cursor,
      includeDeleted: false,
      limit: PROPERTY_EXPORT_BATCH_SIZE,
    });

    for (const entry of page.entries) {
      rowCount += 1;
      if (rowCount > maxRows) {
        throw exportRowLimitExceededError(rowCount, maxRows);
      }
      yield mapIncomeEntryToExportRow(entry, unitLabelById);
    }

    if (page.nextCursor == null) {
      break;
    }
    cursor = page.nextCursor;
  }
}

export function createIncomeCsvReadable(
  propertyId: string,
  filters: TPropertyIncomeEntriesListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): Readable {
  async function* iterateCsvChunks(): AsyncGenerator<string> {
    for await (const row of iterateIncomeExportRows(propertyId, filters, maxRows)) {
      yield csvRow(row.map((value) => (value == null ? "" : String(value))));
    }
  }

  return Readable.from(iterateCsvChunks(), { encoding: "utf8" });
}

export async function uploadIncomeXlsxExport(
  s3Key: string,
  propertyId: string,
  filters: TPropertyIncomeEntriesListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): Promise<void> {
  await uploadXlsxFromRowIterator(
    s3Key,
    "Income",
    iterateIncomeExportRows(propertyId, filters, maxRows)
  );
}
