import { exportJobsDb } from "@/db/export-jobs";
import { propertyExpensesDb } from "@/db/property-expenses";
import { PROPERTY_EXPORT_DUPLICATE_MESSAGE } from "@/lib/property-export-config";
import { normalizeExpenseExportFilters } from "@/lib/property-export-filters";
import {
  ExportFormat,
  ExportResourceType,
  type IPropertyExportCreateRequest,
  type IPropertyExportCreateResponse,
  PROPERTY_EXPORT_MAX_ROWS,
} from "@/packages/shared";
import { enqueuePropertyExportJob } from "@/services/property-export/property-export-reenqueue";

export class PropertyExportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyExportValidationError";
  }
}

export class PropertyExportDuplicateError extends PropertyExportValidationError {
  readonly existingJobId: string;

  constructor(existingJobId: string) {
    super(PROPERTY_EXPORT_DUPLICATE_MESSAGE);
    this.name = "PropertyExportDuplicateError";
    this.existingJobId = existingJobId;
  }
}

export class PropertyExportRowLimitError extends PropertyExportValidationError {
  readonly matchedCount: number;

  constructor(matchedCount: number) {
    super(
      `Export exceeds the maximum of ${PROPERTY_EXPORT_MAX_ROWS.toLocaleString()} rows (found ${matchedCount.toLocaleString()}). Narrow your date range or filters and try again.`
    );
    this.name = "PropertyExportRowLimitError";
    this.matchedCount = matchedCount;
  }
}

export async function createPropertyExport(
  propertyId: string,
  createdBy: string,
  body: IPropertyExportCreateRequest
): Promise<IPropertyExportCreateResponse> {
  if (body.format === ExportFormat.XLSX) {
    throw new PropertyExportValidationError("Excel export is not available yet");
  }

  if (body.resourceType !== ExportResourceType.EXPENSES) {
    throw new PropertyExportValidationError("Unsupported export resource type");
  }

  const filters = normalizeExpenseExportFilters(body.filters);

  const duplicate = await exportJobsDb.findActiveDuplicate({
    createdBy,
    filters,
    format: body.format,
    propertyId,
    resourceType: body.resourceType,
  });
  if (duplicate != null) {
    throw new PropertyExportDuplicateError(duplicate.id);
  }

  const meta = await propertyExpensesDb.getListMetaByProperty(propertyId, filters, false);
  if (meta.totalCount > PROPERTY_EXPORT_MAX_ROWS) {
    throw new PropertyExportRowLimitError(meta.totalCount);
  }

  const job = await exportJobsDb.create({
    createdBy,
    filters,
    format: body.format,
    propertyId,
    resourceType: body.resourceType,
  });

  await enqueuePropertyExportJob(job.id);

  return { jobId: job.id };
}
