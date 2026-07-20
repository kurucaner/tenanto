import { exportJobsDb, type ICreateExportJobInput } from "@/db/export-jobs";
import { propertyExpensesDb } from "@/db/property-expenses";
import { propertyIncomeEntriesDb } from "@/db/property-income-entries";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import {
  propertyExportDuplicateError,
  propertyExportEmptyError,
  propertyExportRowLimitError,
} from "@/errors/export-errors";
import {
  normalizeExpenseExportFilters,
  normalizeIncomeExportFilters,
  normalizeLeaseExportFilters,
} from "@/lib/property-export-filters";
import {
  ExportResourceType,
  type IPropertyExportCreateRequest,
  type IPropertyExportCreateResponse,
  PROPERTY_EXPORT_MAX_ROWS,
} from "@/packages/shared";
import { enqueuePropertyExportJob } from "@/services/property-export/property-export-reenqueue";

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
    throw propertyExportDuplicateError(duplicate.id);
  }

  const matchedCount = await getMatchedRowCount(propertyId, body);
  if (matchedCount === 0) {
    throw propertyExportEmptyError();
  }
  if (matchedCount > PROPERTY_EXPORT_MAX_ROWS) {
    throw propertyExportRowLimitError(matchedCount);
  }

  const job = await exportJobsDb.create(createInput);
  await enqueuePropertyExportJob(job.id);

  return { jobId: job.id };
}
