import { testDateTime } from "../dates";
import { buildExportJobRow } from "../db-rows/export-job-row";
import { sequentialUuid } from "../ids";

const EXPORT_JOB_SPECS = [
  { fileName: "expenses-july.csv", format: "csv", resourceType: "expenses", rowCount: 42 },
  { fileName: "income-june.xlsx", format: "xlsx", resourceType: "income", rowCount: 18 },
  { fileName: "leases-q2.csv", format: "csv", resourceType: "leases", rowCount: 5 },
] as const;

export function buildDescendingExportJobRows(): Record<string, unknown>[] {
  return EXPORT_JOB_SPECS.map((spec, rowIndex) => {
    const dayOffset = -rowIndex;

    return buildExportJobRow({
      created_at: testDateTime(dayOffset),
      file_name: spec.fileName,
      format: spec.format,
      id: sequentialUuid(rowIndex + 1),
      resource_type: spec.resourceType,
      row_count: spec.rowCount,
      updated_at: testDateTime(dayOffset),
    });
  });
}
