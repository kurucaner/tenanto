import type { MultipartFile } from "@fastify/multipart";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import OpenAI from "openai";

import { propertyExpenseCategoryTypesDb } from "@/db/property-expense-category-types";
import { propertyExpensesDb } from "@/db/property-expenses";
import { getOpenAiApiKey } from "@/lib/expense-csv-import-gate";
import { extractExpenseRowsFromCsv } from "@/lib/expense-csv-row-extractor";
import { parseCategoryId, validateExpenseDateNotInFuture } from "@/lib/validate-create-expense-body";
import {
  EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_FILES,
  EXPENSE_CSV_IMPORT_MAX_ROWS_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL,
  HttpStatus,
  type IExpenseImportCommitBody,
  type IExpenseImportFileResult,
  type IExpenseImportParsedRow,
  type IExpenseImportParseResponse,
  type IPropertyExpenseCategoryType,
} from "@/packages/shared";
import {
  categorizeExtractedExpenseRows,
  mergeExtractedRowsWithCategories,
} from "@/services/openai-expense-import-service";
import { WinstonLogger } from "@/services/winston";

import { parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";

interface IPropertyParams {
  propertyId: string;
}

function isBinaryContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  return sample.includes(0);
}


function buildParsedRow(
  sourceFileName: string,
  rowIndex: number,
  row: {
    amount: number;
    categoryId: string;
    description?: string;
    expenseDate?: string;
    taxFree?: boolean;
  }
): IExpenseImportParsedRow {
  if (!Number.isFinite(row.amount) || row.amount < 0) {
    return {
      amount: row.amount,
      categoryId: row.categoryId,
      description: row.description,
      expenseDate: row.expenseDate,
      rowIndex,
      sourceFileName,
      taxFree: row.taxFree,
      validationError: "amount must be a non-negative number",
    };
  }

  const futureDateError = row.expenseDate
    ? validateExpenseDateNotInFuture(row.expenseDate)
    : null;
  if (futureDateError) {
    return {
      amount: row.amount,
      categoryId: row.categoryId,
      description: row.description,
      expenseDate: row.expenseDate,
      rowIndex,
      sourceFileName,
      taxFree: row.taxFree,
      validationError: futureDateError,
    };
  }

  return {
    amount: row.amount,
    categoryId: row.categoryId,
    description: row.description,
    expenseDate: row.expenseDate,
    rowIndex,
    sourceFileName,
    taxFree: row.taxFree,
  };
}

async function readMultipartCsvFiles(
  request: FastifyRequest
): Promise<{ error: string } | { files: Array<{ buffer: Buffer; fileName: string }> }> {
  const files: Array<{ buffer: Buffer; fileName: string }> = [];

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      continue;
    }

    const filePart = part as MultipartFile;
    if (files.length >= EXPENSE_CSV_IMPORT_MAX_FILES) {
      return { error: `At most ${EXPENSE_CSV_IMPORT_MAX_FILES} files are allowed` };
    }

    const fileName = filePart.filename.trim() || "upload.csv";
    if (!fileName.toLowerCase().endsWith(".csv")) {
      return { error: "Only .csv files are supported" };
    }

    const buffer = await filePart.toBuffer();
    if (buffer.length === 0) {
      return { error: `${fileName} is empty` };
    }
    if (buffer.length > EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE) {
      return { error: `${fileName} exceeds the 1 MB file size limit` };
    }
    if (isBinaryContent(buffer)) {
      return { error: `${fileName} does not look like a text CSV file` };
    }

    files.push({ buffer, fileName });
  }

  if (files.length === 0) {
    return { error: "At least one CSV file is required" };
  }

  return { files };
}

async function parseUploadedCsvFile(
  client: OpenAI,
  fileName: string,
  buffer: Buffer,
  categoryTypes: IPropertyExpenseCategoryType[]
): Promise<IExpenseImportFileResult> {
  const csvText = buffer.toString("utf8").trim();
  if (csvText === "") {
    return {
      fileName,
      message: "The file is empty.",
      status: "error",
    };
  }

  WinstonLogger.info("expense_csv_import_file_read", {
    csvTextLength: csvText.length,
    fileName,
    originalBytes: buffer.length,
  });

  const extracted = extractExpenseRowsFromCsv(csvText, fileName);
  if ("error" in extracted) {
    return {
      fileName,
      message: extracted.error,
      status: "error",
    };
  }

  if (extracted.rows.length === 0) {
    return {
      fileName,
      message: "No charge transactions were found in this file.",
      status: "irrelevant",
    };
  }

  if (extracted.rows.length > EXPENSE_CSV_IMPORT_MAX_ROWS_PER_FILE) {
    return {
      fileName,
      message: `This file has more than ${EXPENSE_CSV_IMPORT_MAX_ROWS_PER_FILE} expense rows.`,
      status: "error",
    };
  }

  try {
    const categorization = await categorizeExtractedExpenseRows(
      client,
      extracted.rows,
      categoryTypes,
      fileName
    );
    if ("error" in categorization) {
      WinstonLogger.warn("expense_csv_import_file_parse_error", {
        error: categorization.error,
        fileName,
      });
      return {
        fileName,
        message: categorization.error,
        status: "error",
      };
    }

    if (categorization.assignments.length !== extracted.rows.length) {
      WinstonLogger.warn("expense_csv_import_row_count_mismatch", {
        assignmentCount: categorization.assignments.length,
        extractedCount: extracted.rows.length,
        fileName,
      });
    }

    const mergedRows = mergeExtractedRowsWithCategories(
      extracted.rows,
      categorization.assignments,
      categoryTypes
    );
    const rows = mergedRows.map((row) => buildParsedRow(fileName, row.rowIndex, row));

    return {
      fileName,
      message: `${extracted.rows.length} charge transaction(s) found and categorized`,
      rows,
      status: "parsed",
    };
  } catch (error) {
    WinstonLogger.error("expense_csv_import_file_parse_failed", {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : "UnknownError",
      fileName,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      fileName,
      message: "Failed to categorize this file with AI.",
      status: "error",
    };
  }
}

function validateCommitRows(
  rows: IExpenseImportParsedRow[]
): { error: string } | { ok: true; rows: IExpenseImportParsedRow[] } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "At least one expense row is required" };
  }
  if (rows.length > EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL) {
    return {
      error: `At most ${EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL} expenses can be imported at once`,
    };
  }

  const validatedRows: IExpenseImportParsedRow[] = [];
  for (const [index, row] of rows.entries()) {
    const categoryId = parseCategoryId(row.categoryId);
    if (!categoryId) {
      return { error: `Row ${index + 1}: categoryId must be a valid UUID` };
    }
    if (!Number.isFinite(row.amount) || row.amount < 0) {
      return { error: `Row ${index + 1}: amount must be a non-negative number` };
    }

    const futureDateError = validateExpenseDateNotInFuture(row.expenseDate);
    if (futureDateError) {
      return { error: `Row ${index + 1}: ${futureDateError}` };
    }

    validatedRows.push({
      amount: row.amount,
      categoryId,
      description: row.description,
      expenseDate: row.expenseDate,
      rowIndex: row.rowIndex,
      sourceFileName: row.sourceFileName,
      taxFree: row.taxFree,
    });
  }

  return { ok: true, rows: validatedRows };
}

export const propertyExpenseImportRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.post<{ Params: IPropertyParams }>(
    "/properties/:propertyId/expenses/import/parse",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes",
        },
      },
      preHandler: authPre,
    },
    async (request: FastifyRequest<{ Params: IPropertyParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const canWrite = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners and managers can manage expenses"
      );
      if (!canWrite) return;

      const apiKey = getOpenAiApiKey();
      if (apiKey === null) {
        return reply.status(HttpStatus.SERVICE_UNAVAILABLE).send({
          error: "Expense CSV import is not configured (missing OPENAI_API_KEY)",
        });
      }

      const fileRead = await readMultipartCsvFiles(request);
      if ("error" in fileRead) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: fileRead.error });
      }

      const categoryTypes = await propertyExpenseCategoryTypesDb.findByProperty(propertyId);

      const client = new OpenAI({ apiKey });
      const settled = await Promise.allSettled(
        fileRead.files.map((file) =>
          parseUploadedCsvFile(client, file.fileName, file.buffer, categoryTypes)
        )
      );

      const files: IExpenseImportFileResult[] = settled.map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        WinstonLogger.error("expense_csv_import_file_settled_rejected", {
          fileName: fileRead.files[index]?.fileName ?? "unknown.csv",
          reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
        return {
          fileName: fileRead.files[index]?.fileName ?? "unknown.csv",
          message: "Failed to parse this file.",
          status: "error",
        };
      });

      const totalRows = files.reduce((count, file) => count + (file.rows?.length ?? 0), 0);
      if (totalRows > EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: `Combined import exceeds ${EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL} expense rows`,
        });
      }

      request.log.info({
        event: "expense_csv_import_parse",
        fileCount: files.length,
        propertyId,
        rowCount: totalRows,
        userId: request.user.userId,
      });

      const response: IExpenseImportParseResponse = { files };
      return reply.send(response);
    }
  );

  server.post<{ Body: IExpenseImportCommitBody; Params: IPropertyParams }>(
    "/properties/:propertyId/expenses/import/commit",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Body: IExpenseImportCommitBody; Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const canWrite = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners and managers can manage expenses"
      );
      if (!canWrite) return;

      const body = request.body as IExpenseImportCommitBody;
      const validated = validateCommitRows(body.rows);
      if ("error" in validated) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: validated.error });
      }

      const categoryTypes = await propertyExpenseCategoryTypesDb.findByProperty(propertyId);
      const categoryTypeIds = new Set(categoryTypes.map((t) => t.id));

      for (const [index, row] of validated.rows.entries()) {
        if (!categoryTypeIds.has(row.categoryId)) {
          return reply
            .status(HttpStatus.BAD_REQUEST)
            .send({ error: `Row ${index + 1}: category not found for this property` });
        }
      }

      const expenses = await propertyExpensesDb.createMany(
        propertyId,
        validated.rows.map((row) => ({
          amount: row.amount,
          categoryId: row.categoryId,
          description: row.description?.trim() || null,
          expenseDate: row.expenseDate ?? null,
          taxFree: row.taxFree ?? false,
        }))
      );

      request.log.info({
        createdCount: expenses.length,
        event: "expense_csv_import_commit",
        propertyId,
        userId: request.user.userId,
      });

      return reply.status(HttpStatus.CREATED).send({
        createdCount: expenses.length,
        expenses,
      });
    }
  );
};
