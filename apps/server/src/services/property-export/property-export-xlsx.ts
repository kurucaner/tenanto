import { PassThrough } from "node:stream";

import ExcelJS from "exceljs";

import { putObjectStream } from "@/s3/s3-commands";

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type TExportSpreadsheetRow = (string | number | null)[];

export async function uploadXlsxFromRowIterator(
  s3Key: string,
  sheetName: string,
  iterateRows: AsyncIterable<TExportSpreadsheetRow>
): Promise<void> {
  const stream = new PassThrough();
  const uploadPromise = putObjectStream(s3Key, stream, XLSX_CONTENT_TYPE);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream });
  const worksheet = workbook.addWorksheet(sheetName);

  for await (const row of iterateRows) {
    worksheet.addRow([...row]).commit();
  }

  await workbook.commit();
  await uploadPromise;
}
