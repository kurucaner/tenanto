import { Readable } from "node:stream";

import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import { csvRow } from "@/lib/csv-utils";
import { PROPERTY_EXPORT_BATCH_SIZE } from "@/lib/property-export-config";
import {
  getLeaseOccupancyNames,
  type IPropertyLongStay,
  PROPERTY_EXPORT_MAX_ROWS,
  type TPropertyLongStaysListFilters,
} from "@/packages/shared";

import { ExportRowLimitExceededError } from "./expenses-csv-export";
import { type TExportSpreadsheetRow, uploadXlsxFromRowIterator } from "./property-export-xlsx";

const LEASE_EXPORT_HEADERS = [
  "Unit",
  "Tenant",
  "Start",
  "End",
  "Rent/mo",
  "Status",
  "Email",
  "Phone",
] as const;

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

function resolveLeaseEndDate(lease: IPropertyLongStay): string {
  return lease.actualEndDate ?? lease.leaseEndDate;
}

function mapLeaseToExportRow(
  lease: IPropertyLongStay,
  unitLabelById: Map<string, string>
): TExportSpreadsheetRow {
  return [
    unitLabelById.get(lease.unitId) ?? lease.unitId,
    getLeaseOccupancyNames(lease).join(", "),
    lease.leaseStartDate,
    resolveLeaseEndDate(lease),
    formatMoney(lease.monthlyRent),
    lease.status,
    lease.tenantEmail ?? "",
    lease.tenantPhone ?? "",
  ];
}

export function buildLeasesExportFileName(
  filters: TPropertyLongStaysListFilters,
  format: "csv" | "xlsx" = "csv"
): string {
  const from = filters.from ?? "all";
  const to = filters.to ?? "all";
  return `leases-${from}-${to}.${format}`;
}

async function buildUnitLabelMap(propertyId: string): Promise<Map<string, string>> {
  const units = await propertyUnitsDb.findByProperty(propertyId, false);
  return new Map(units.map((unit) => [unit.id, unit.unitNumber]));
}

export async function* iterateLeasesExportRows(
  propertyId: string,
  filters: TPropertyLongStaysListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): AsyncGenerator<TExportSpreadsheetRow> {
  const unitLabelById = await buildUnitLabelMap(propertyId);
  yield [...LEASE_EXPORT_HEADERS];

  let cursor: string | undefined;
  let rowCount = 0;

  for (;;) {
    const page = await propertyLongStaysDb.listPaginatedPage(propertyId, filters, {
      cursor,
      limit: PROPERTY_EXPORT_BATCH_SIZE,
    });

    for (const lease of page.longStays) {
      rowCount += 1;
      if (rowCount > maxRows) {
        throw new ExportRowLimitExceededError(rowCount, maxRows);
      }
      yield mapLeaseToExportRow(lease, unitLabelById);
    }

    if (page.nextCursor == null) {
      break;
    }
    cursor = page.nextCursor;
  }
}

export function createLeasesCsvReadable(
  propertyId: string,
  filters: TPropertyLongStaysListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): Readable {
  async function* iterateCsvChunks(): AsyncGenerator<string> {
    for await (const row of iterateLeasesExportRows(propertyId, filters, maxRows)) {
      yield csvRow(row.map((value) => (value == null ? "" : String(value))));
    }
  }

  return Readable.from(iterateCsvChunks(), { encoding: "utf8" });
}

export async function uploadLeasesXlsxExport(
  s3Key: string,
  propertyId: string,
  filters: TPropertyLongStaysListFilters,
  maxRows = PROPERTY_EXPORT_MAX_ROWS
): Promise<void> {
  await uploadXlsxFromRowIterator(
    s3Key,
    "Leases",
    iterateLeasesExportRows(propertyId, filters, maxRows)
  );
}
