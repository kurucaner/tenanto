import {
  ExportFormat,
  ExportResourceType,
  type TExportFormat,
  type TExportResourceType,
} from "@/packages/shared";

export function getExportResourceTypeLabel(resourceType: TExportResourceType): string {
  if (resourceType === ExportResourceType.EXPENSES) return "expenses";
  if (resourceType === ExportResourceType.INCOME) return "income";
  if (resourceType === ExportResourceType.LEASES) return "leases";
  return resourceType;
}

export function getExportFormatLabel(format: TExportFormat): string {
  if (format === ExportFormat.CSV) return "CSV";
  if (format === ExportFormat.XLSX) return "Excel";
  return format;
}
