import { type TPropertyExpensesListFilters } from "@/packages/shared";
import { iterateExpenseExportRows } from "@/services/property-export/expenses-csv-export";
import { uploadXlsxFromRowIterator } from "@/services/property-export/property-export-xlsx";

export async function uploadExpensesXlsxExport(
  s3Key: string,
  propertyId: string,
  filters: TPropertyExpensesListFilters
): Promise<void> {
  await uploadXlsxFromRowIterator(s3Key, "Expenses", iterateExpenseExportRows(propertyId, filters));
}
