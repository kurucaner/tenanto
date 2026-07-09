import type { MultipartFile } from "@fastify/multipart";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import OpenAI from "openai";

import { propertyExpenseCategoriesDb } from "@/db/property-expense-categories";
import { propertyExpensesDb } from "@/db/property-expenses";
import { getOpenAiApiKey, isExpenseCsvImportEnabled } from "@/lib/expense-csv-import-gate";
import { extractExpenseRowsFromCsv } from "@/lib/expense-csv-row-extractor";
import {
  parseCreateExpenseBody,
  validateExpenseDateNotInFuture,
} from "@/lib/validate-create-expense-body";
import {
  EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_FILES,
  EXPENSE_CSV_IMPORT_MAX_ROWS_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL,
  EXPENSE_CSV_IMPORT_MAX_TEXT_BYTES,
  HttpStatus,
  type IExpenseImportCommitBody,
  type IExpenseImportFileResult,
  type IExpenseImportParsedRow,
  type IExpenseImportParseResponse,
  type TExpenseCategory,
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

function rejectIfImportDisabled(reply: FastifyReply): boolean {
  if (!isExpenseCsvImportEnabled()) {
    void reply.status(HttpStatus.NOT_FOUND).send({ error: "Not found" });
    return true;
  }
  return false;
}

function isBinaryContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  return sample.includes(0);
}

function truncateCsvText(text: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= EXPENSE_CSV_IMPORT_MAX_TEXT_BYTES) {
    return text;
  }
  const truncated = bytes.slice(0, EXPENSE_CSV_IMPORT_MAX_TEXT_BYTES);
  return new TextDecoder().decode(truncated);
}

function buildParsedRow(
  sourceFileName: string,
  rowIndex: number,
  row: {
    amount: number;
    category: IExpenseImportParsedRow["category"];
    description?: string;
    expenseDate?: string;
    taxFree?: boolean;
  }
): IExpenseImportParsedRow {
  const bodyCandidate = {
    amount: row.amount,
    category: row.category,
    description: row.description,
    expenseDate: row.expenseDate,
    taxFree: row.taxFree,
  };

  const parsed = parseCreateExpenseBody(bodyCandidate);
  if (!parsed.ok) {
    return {
      ...bodyCandidate,
      rowIndex,
      sourceFileName,
      validationError: parsed.error,
    };
  }

  const futureDateError = validateExpenseDateNotInFuture(parsed.body.expenseDate);
  if (futureDateError) {
    return {
      ...bodyCandidate,
      rowIndex,
      sourceFileName,
      validationError: futureDateError,
    };
  }

  return {
    amount: parsed.body.amount,
    category: parsed.body.category,
    description: parsed.body.description,
    expenseDate: parsed.body.expenseDate,
    rowIndex,
    sourceFileName,
    taxFree: parsed.body.taxFree,
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
  allowedCategories: readonly TExpenseCategory[]
): Promise<IExpenseImportFileResult> {
  const csvText = truncateCsvText(buffer.toString("utf8").trim());
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
      allowedCategories,
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

    const mergedRows = mergeExtractedRowsWithCategories(extracted.rows, categorization.assignments);
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
    const parsed = parseCreateExpenseBody({
      amount: row.amount,
      category: row.category,
      description: row.description,
      expenseDate: row.expenseDate,
      taxFree: row.taxFree,
    });
    if (!parsed.ok) {
      return { error: `Row ${index + 1}: ${parsed.error}` };
    }

    const futureDateError = validateExpenseDateNotInFuture(parsed.body.expenseDate);
    if (futureDateError) {
      return { error: `Row ${index + 1}: ${futureDateError}` };
    }

    validatedRows.push({
      amount: parsed.body.amount,
      category: parsed.body.category,
      description: parsed.body.description,
      expenseDate: parsed.body.expenseDate,
      rowIndex: row.rowIndex,
      sourceFileName: row.sourceFileName,
      taxFree: parsed.body.taxFree,
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
      if (rejectIfImportDisabled(reply)) return;

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

      const client = new OpenAI({ apiKey });
      const allowedCategories = await propertyExpenseCategoriesDb.listValues();
      const settled = await Promise.allSettled(
        fileRead.files.map((file) =>
          parseUploadedCsvFile(client, file.fileName, file.buffer, allowedCategories)
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
      if (rejectIfImportDisabled(reply)) return;

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

      const expenses = await propertyExpensesDb.createMany(
        propertyId,
        validated.rows.map((row) => ({
          amount: row.amount,
          category: row.category,
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
