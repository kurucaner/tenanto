import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyChannelCommissionsDb } from "@/db/property-channel-commissions";
import { propertySettingsDb } from "@/db/property-settings";
import { propertyTaxRatesDb } from "@/db/property-tax-rates";
import { propertyUnitsDb } from "@/db/property-units";
import {
  buildIncomeImportParsedRow,
  type IIncomeCsvImportContext,
} from "@/lib/income-csv-import-resolvers";
import { extractIncomeRowsFromHotelTaxCalculatorCsv } from "@/lib/income-hotel-tax-calculator-csv-extractor";
import { readMultipartCsvFiles } from "@/lib/read-multipart-csv-files";
import {
  HttpStatus,
  type IIncomeImportFileResult,
  type IIncomeImportParseResponse,
  INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE,
  INCOME_CSV_IMPORT_MAX_FILES,
  INCOME_CSV_IMPORT_MAX_ROWS_PER_FILE,
  INCOME_CSV_IMPORT_MAX_ROWS_TOTAL,
} from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";

interface IPropertyParams {
  propertyId: string;
}

async function loadIncomeCsvImportContext(propertyId: string): Promise<IIncomeCsvImportContext> {
  const [units, channels, taxRates] = await Promise.all([
    propertyUnitsDb.findByProperty(propertyId),
    propertyChannelCommissionsDb.findByProperty(propertyId),
    propertyTaxRatesDb.findByProperty(propertyId),
  ]);

  return { channels, taxRates, units };
}

function parseUploadedIncomeCsvFile(
  fileName: string,
  buffer: Buffer,
  context: IIncomeCsvImportContext
): IIncomeImportFileResult {
  const csvText = buffer.toString("utf8").trim();
  if (csvText === "") {
    return {
      fileName,
      message: "The file is empty.",
      status: "error",
    };
  }

  const extracted = extractIncomeRowsFromHotelTaxCalculatorCsv(csvText, fileName);
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
      message: "No importable income rows were found.",
      status: "irrelevant",
    };
  }

  if (extracted.rows.length > INCOME_CSV_IMPORT_MAX_ROWS_PER_FILE) {
    return {
      fileName,
      message: `This file has more than ${INCOME_CSV_IMPORT_MAX_ROWS_PER_FILE} income rows.`,
      status: "error",
    };
  }

  const rows = extracted.rows.map((row) => buildIncomeImportParsedRow(row, context));
  const invalidCount = rows.filter((row) => row.validationError).length;

  return {
    fileName,
    message:
      invalidCount > 0
        ? `${rows.length} stay row(s) found (${invalidCount} need attention)`
        : `${rows.length} stay row(s) ready for review`,
    rows,
    status: "parsed",
  };
}

export const propertyIncomeImportRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.post<{ Params: IPropertyParams }>(
    "/properties/:propertyId/income/import/parse",
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
        "Only property owners and managers can manage income entries"
      );
      if (!canWrite) return;

      const fileRead = await readMultipartCsvFiles(request, {
        maxBytesPerFile: INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE,
        maxFiles: INCOME_CSV_IMPORT_MAX_FILES,
      });
      if ("error" in fileRead) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: fileRead.error });
      }

      await propertySettingsDb.getOrCreateDefaults(propertyId);
      const context = await loadIncomeCsvImportContext(propertyId);

      const files = fileRead.files.map((file) =>
        parseUploadedIncomeCsvFile(file.fileName, file.buffer, context)
      );

      const totalRows = files.reduce((count, file) => count + (file.rows?.length ?? 0), 0);
      if (totalRows > INCOME_CSV_IMPORT_MAX_ROWS_TOTAL) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: `Combined import exceeds ${INCOME_CSV_IMPORT_MAX_ROWS_TOTAL} income rows`,
        });
      }

      request.log.info({
        event: "income_csv_import_parse",
        fileCount: files.length,
        propertyId,
        rowCount: totalRows,
        userId: request.user.userId,
      });

      const response: IIncomeImportParseResponse = { files };
      return reply.send(response);
    }
  );
};
