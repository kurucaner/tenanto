import { exportJobsDb, type ICreateExportJobInput } from "@/db/export-jobs";
import { propertyExpensesDb } from "@/db/property-expenses";
import { propertyIncomeEntriesDb } from "@/db/property-income-entries";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { PROPERTY_EXPORT_DUPLICATE_MESSAGE } from "@/lib/property-export-config";
import {
  normalizeExpenseExportFilters,
  normalizeIncomeExportFilters,
  normalizeLeaseExportFilters,
} from "@/lib/property-export-filters";
import {
  ExportResourceType,
  type IPropertyExportCreateRequest,
  type IPropertyExportCreateResponse,
  PROPERTY_EXPORT_EMPTY_MESSAGE,
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

export class PropertyExportEmptyError extends PropertyExportValidationError {
  constructor() {
    super(PROPERTY_EXPORT_EMPTY_MESSAGE);
    this.name = "PropertyExportEmptyError";
  }
}

async function getMatchedRowCount(
  propertyId: string,
  body: IPropertyExportCreateRequest
): Promise<number> {
  if (body.resourceType === ExportResourceType.EXPENSES) {
    const meta = await propertyExpensesDb.getListMetaByProperty(propertyId, body.filters, false);
    return meta.totalCount;
  }

  if (body.resourceType === ExportResourceType.INCOME) {
    const meta = await propertyIncomeEntriesDb.getListMetaByProperty(
      propertyId,
      body.filters,
      false
    );
    return meta.totalCount;
  }

  const meta = await propertyLongStaysDb.getListMetaByProperty(propertyId, body.filters);
  return meta.totalCount;
}

function buildCreateJobInput(
  propertyId: string,
  createdBy: string,
  body: IPropertyExportCreateRequest
): ICreateExportJobInput {
  if (body.resourceType === ExportResourceType.EXPENSES) {
    return {
      createdBy,
      filters: normalizeExpenseExportFilters(body.filters),
      format: body.format,
      propertyId,
      resourceType: body.resourceType,
    };
  }

  if (body.resourceType === ExportResourceType.INCOME) {
    return {
      createdBy,
      filters: normalizeIncomeExportFilters(body.filters),
      format: body.format,
      propertyId,
      resourceType: body.resourceType,
    };
  }

  return {
    createdBy,
    filters: normalizeLeaseExportFilters(body.filters),
    format: body.format,
    propertyId,
    resourceType: body.resourceType,
  };
}

export async function createPropertyExport(
  propertyId: string,
  createdBy: string,
  body: IPropertyExportCreateRequest
): Promise<IPropertyExportCreateResponse> {
  const createInput = buildCreateJobInput(propertyId, createdBy, body);

  const duplicate = await exportJobsDb.findActiveDuplicate(createInput);
  if (duplicate != null) {
    throw new PropertyExportDuplicateError(duplicate.id);
  }

  const matchedCount = await getMatchedRowCount(propertyId, body);
  if (matchedCount === 0) {
    throw new PropertyExportEmptyError();
  }
  if (matchedCount > PROPERTY_EXPORT_MAX_ROWS) {
    throw new PropertyExportRowLimitError(matchedCount);
  }

  const job = await exportJobsDb.create(createInput);
  await enqueuePropertyExportJob(job.id);

  return { jobId: job.id };
}
