import {
  type IIncomeCsvExtractedRow,
  ReservationStatus,
  type TReservationStatus,
} from "@/packages/shared";

import { parseCsvRecords } from "./csv-records-parser";

const HOTEL_TAX_CALCULATOR_HEADERS = [
  "month",
  "guess name",
  "room no",
  "check in date",
  "check out date",
  "number of night",
  "status",
  "room rate",
  "cleaning fee",
  "channel",
] as const;

const COLUMN = {
  channel: 9,
  checkIn: 3,
  checkOut: 4,
  cleaningFee: 8,
  guestName: 1,
  nights: 5,
  roomNo: 2,
  roomRate: 7,
  status: 6,
} as const;

export type TIncomeCsvExtractResult =
  | { error: string }
  | { ok: true; rows: IIncomeCsvExtractedRow[] };

export function isHotelTaxCalculatorCsv(headers: string[]): boolean {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  return HOTEL_TAX_CALCULATOR_HEADERS.every((expected, index) => normalized[index] === expected);
}

export function extractIncomeRowsFromHotelTaxCalculatorCsv(
  csvText: string,
  sourceFileName: string
): TIncomeCsvExtractResult {
  const parsed = parseCsvRecords(csvText);
  if (parsed.length === 0) {
    return { error: "The file is empty." };
  }

  const [headerRow, ...dataRows] = parsed;
  if (!headerRow || headerRow.length === 0) {
    return { error: "The file is empty." };
  }

  const normalizedHeaders = headerRow.map((header) => header.trim().toLowerCase());
  if (!isHotelTaxCalculatorCsv(normalizedHeaders)) {
    return { error: "This file does not match the Hotel Tax Calculator CSV format." };
  }

  const rows: IIncomeCsvExtractedRow[] = [];
  for (let index = 0; index < dataRows.length; index += 1) {
    const dataRow = dataRows[index];
    if (!dataRow || isJunkIncomeCsvRow(dataRow)) {
      continue;
    }

    const extracted = parseHotelTaxCalculatorDataRow(dataRow, index + 2, sourceFileName);
    if (extracted) {
      rows.push(extracted);
    }
  }

  if (rows.length === 0) {
    return { error: "No importable income rows were found." };
  }

  return { ok: true, rows };
}

function isJunkIncomeCsvRow(row: string[]): boolean {
  const guestName = getColumnValue(row, COLUMN.guestName);
  if (guestName.trim() === "") {
    return true;
  }
  return row.some((field) => field.includes("Err:522"));
}

function parseHotelTaxCalculatorDataRow(
  row: string[],
  rowIndex: number,
  sourceFileName: string
): IIncomeCsvExtractedRow | null {
  const guestName = getColumnValue(row, COLUMN.guestName).trim();
  const roomNo = getColumnValue(row, COLUMN.roomNo).trim();
  const statusRaw = getColumnValue(row, COLUMN.status);
  const statusMapping = mapCsvStatus(statusRaw);
  if (!statusMapping) {
    return null;
  }

  const checkIn = parseIncomeCsvDate(getColumnValue(row, COLUMN.checkIn));
  const checkOut = parseIncomeCsvDate(getColumnValue(row, COLUMN.checkOut));
  if (!checkIn || !checkOut) {
    return null;
  }

  const nights = parseInteger(getColumnValue(row, COLUMN.nights));
  if (nights === null || nights < 0) {
    return null;
  }

  const roomTotal = parseCsvMoney(getColumnValue(row, COLUMN.roomRate));
  const cleaningFee = parseCsvMoney(getColumnValue(row, COLUMN.cleaningFee));
  if (roomTotal === null || cleaningFee === null) {
    return null;
  }

  const channelName = getColumnValue(row, COLUMN.channel).trim();
  if (channelName === "") {
    return null;
  }

  return {
    channelName,
    checkIn,
    checkOut,
    cleaningFee,
    guestName,
    nights,
    refunded: statusMapping.refunded,
    roomNo,
    roomTotal,
    rowIndex,
    sourceFileName,
    status: statusMapping.status,
  };
}

function getColumnValue(row: string[], index: number): string {
  return row[index]?.trim() ?? "";
}

function mapCsvStatus(
  raw: string
): { refunded: boolean; status: TReservationStatus } | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "checked") {
    return { refunded: false, status: ReservationStatus.STAYED };
  }
  if (normalized === "canceled" || normalized === "cancelled") {
    return { refunded: false, status: ReservationStatus.CANCELED };
  }
  if (normalized === "no show") {
    return { refunded: false, status: ReservationStatus.NO_SHOW };
  }
  if (normalized === "refund") {
    return { refunded: true, status: ReservationStatus.STAYED };
  }
  return null;
}

export function parseIncomeCsvDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const dashed = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
  if (dashed) {
    const month = dashed[1]?.padStart(2, "0");
    const day = dashed[2]?.padStart(2, "0");
    const year = dashed[3];
    if (month && day && year) {
      return `${year}-${month}-${day}`;
    }
  }

  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashed) {
    const month = slashed[1]?.padStart(2, "0");
    const day = slashed[2]?.padStart(2, "0");
    const year = slashed[3];
    if (month && day && year) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

export function parseCsvMoney(raw: string): number | null {
  const normalized = raw.trim().replace(/[$,]/g, "");
  if (normalized === "") {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
