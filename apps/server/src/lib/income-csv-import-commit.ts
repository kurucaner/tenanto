import {
  type ICreatePropertyReservationBody,
  type IIncomeImportParsedRow,
  type IPropertyReservationComputedFields,
  recomputeIncomeImportPreviewRow,
  ReservationStatus,
  type TReservationStatus,
} from "@/packages/shared";
import { parseDateString, parseUuidParam } from "@/routes/admin/admin-query-utils";
import { parseMoney } from "@/routes/admin/parse-body-utils";

import { type IIncomeCsvImportContext } from "./income-csv-import-resolvers";

const COMMIT_RESERVATION_STATUSES = new Set<TReservationStatus>([
  ReservationStatus.STAYED,
  ReservationStatus.CANCELED,
  ReservationStatus.NO_SHOW,
]);

export interface IIncomeImportCommitRow {
  computed: IPropertyReservationComputedFields;
  input: ICreatePropertyReservationBody;
  refunded: boolean;
}

function parseCommitReservationStatus(raw: unknown): TReservationStatus | null {
  if (typeof raw !== "string") return null;
  return COMMIT_RESERVATION_STATUSES.has(raw as TReservationStatus)
    ? (raw as TReservationStatus)
    : null;
}

function parseCommitRowShape(
  raw: unknown,
  index: number
): { error: string } | { ok: true; row: IIncomeImportParsedRow } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: `Row ${index + 1}: must be an object` };
  }

  const record = raw as Record<string, unknown>;
  if (typeof record.guestName !== "string" || record.guestName.trim() === "") {
    return { error: `Row ${index + 1}: guestName is required` };
  }

  const unitId = parseUuidParam(record.unitId);
  if (unitId === null) {
    return { error: `Row ${index + 1}: unitId must be a valid UUID` };
  }

  const channelCommissionId = parseUuidParam(record.channelCommissionId);
  if (channelCommissionId === null) {
    return { error: `Row ${index + 1}: channelCommissionId must be a valid UUID` };
  }

  const checkIn = parseDateString(record.checkIn);
  const checkOut = parseDateString(record.checkOut);
  if (!checkIn || !checkOut) {
    return { error: `Row ${index + 1}: checkIn and checkOut must be YYYY-MM-DD dates` };
  }

  const status = parseCommitReservationStatus(record.status);
  if (status === null) {
    return {
      error: `Row ${index + 1}: status must be one of: ${[...COMMIT_RESERVATION_STATUSES].join(", ")}`,
    };
  }

  const roomTotal = parseMoney(record.roomTotal);
  if (roomTotal === null) {
    return { error: `Row ${index + 1}: roomTotal must be a non-negative number` };
  }

  const cleaningFee = parseMoney(record.cleaningFee);
  if (cleaningFee === null) {
    return { error: `Row ${index + 1}: cleaningFee must be a non-negative number` };
  }

  if (typeof record.refunded !== "boolean") {
    return { error: `Row ${index + 1}: refunded must be a boolean` };
  }

  if (typeof record.nights !== "number" || !Number.isFinite(record.nights) || record.nights < 1) {
    return { error: `Row ${index + 1}: nights must be a positive number` };
  }

  if (typeof record.rowIndex !== "number" || !Number.isFinite(record.rowIndex)) {
    return { error: `Row ${index + 1}: rowIndex must be a number` };
  }

  if (typeof record.sourceFileName !== "string" || record.sourceFileName.trim() === "") {
    return { error: `Row ${index + 1}: sourceFileName is required` };
  }

  return {
    ok: true,
    row: {
      channelCommissionId,
      checkIn,
      checkOut,
      cleaningFee,
      guestName: record.guestName,
      nights: Math.floor(record.nights),
      refunded: record.refunded,
      roomTotal,
      rowIndex: Math.floor(record.rowIndex),
      sourceFileName: record.sourceFileName.trim(),
      status,
      unitId,
    },
  };
}

export function validateIncomeImportCommitRows(
  rawRows: unknown,
  context: IIncomeCsvImportContext,
  propertyId: string,
  maxRows: number
): { error: string } | { ok: true; rows: IIncomeImportCommitRow[] } {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { error: "At least one income row is required" };
  }

  if (rawRows.length > maxRows) {
    return { error: `At most ${maxRows} income rows can be imported at once` };
  }

  const unitIds = new Set(context.units.map((unit) => unit.id));
  const channelIds = new Set(context.channels.map((channel) => channel.id));
  const commitRows: IIncomeImportCommitRow[] = [];

  for (const [index, rawRow] of rawRows.entries()) {
    const parsed = parseCommitRowShape(rawRow, index);
    if ("error" in parsed) {
      return parsed;
    }

    const unit = context.units.find((candidate) => candidate.id === parsed.row.unitId);
    if (!unit || unit.propertyId !== propertyId || !unitIds.has(parsed.row.unitId)) {
      return { error: `Row ${index + 1}: unit not found for this property` };
    }

    const channel = context.channels.find(
      (candidate) => candidate.id === parsed.row.channelCommissionId
    );
    if (
      !channel ||
      channel.propertyId !== propertyId ||
      !channelIds.has(parsed.row.channelCommissionId)
    ) {
      return { error: `Row ${index + 1}: channel not found for this property` };
    }

    const validated = recomputeIncomeImportPreviewRow(parsed.row, context);
    if (validated.validationError) {
      return { error: `Row ${index + 1}: ${validated.validationError}` };
    }

    if (validated.computedNights === undefined) {
      return { error: `Row ${index + 1}: could not compute stay nights` };
    }

    if (
      validated.channelCommission === undefined ||
      validated.channelCommissionRate === undefined ||
      validated.grossIncome === undefined ||
      validated.netIncome === undefined ||
      !validated.taxBreakdown
    ) {
      return { error: `Row ${index + 1}: could not compute stay income` };
    }

    commitRows.push({
      computed: {
        channelCommission: validated.channelCommission,
        channelCommissionRate: validated.channelCommissionRate,
        grossIncome: validated.grossIncome,
        netIncome: validated.netIncome,
        nights: validated.computedNights,
        taxBreakdown: validated.taxBreakdown,
      },
      input: {
        channelCommissionId: validated.channelCommissionId,
        checkIn: validated.checkIn,
        checkOut: validated.checkOut,
        cleaningFee: validated.cleaningFee,
        guestName: validated.guestName,
        roomTotal: validated.roomTotal,
        status: validated.status,
        unitId: validated.unitId,
      },
      refunded: validated.refunded,
    });
  }

  return { ok: true, rows: commitRows };
}
