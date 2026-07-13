import type { IPropertyReservation, TReservationStatus } from "./property-reservation-types";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";

export const INCOME_CSV_IMPORT_MAX_FILES = 5;
export const INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE = 1_048_576;
export const INCOME_CSV_IMPORT_MAX_ROWS_PER_FILE = 2000;
export const INCOME_CSV_IMPORT_MAX_ROWS_TOTAL = 2000;

export type TIncomeImportFileStatus = "error" | "irrelevant" | "parsed";

/** Raw row produced by the deterministic Hotel Tax Calculator CSV extractor (Phase 1). */
export interface IIncomeCsvExtractedRow {
  channelName: string;
  checkIn: string;
  checkOut: string;
  cleaningFee: number;
  guestName: string;
  nights: number;
  refunded: boolean;
  roomNo: string;
  roomTotal: number;
  rowIndex: number;
  sourceFileName: string;
  status: TReservationStatus;
}

/** Row after unit/channel resolution and validation (Phase 2+). */
export interface IIncomeImportParsedRow {
  channelCommission?: number;
  channelCommissionId: string;
  channelCommissionRate?: number;
  channelName?: string;
  checkIn: string;
  checkOut: string;
  cleaningFee: number;
  computedNights?: number;
  grossIncome?: number;
  guestName: string;
  netIncome?: number;
  nights: number;
  refunded: boolean;
  roomNo?: string;
  roomTotal: number;
  rowIndex: number;
  sourceFileName: string;
  status: TReservationStatus;
  taxBreakdown?: IPropertyTaxBreakdownItem[];
  unitId: string;
  validationError?: string;
}

export interface IIncomeImportFileResult {
  fileName: string;
  message?: string;
  rows?: IIncomeImportParsedRow[];
  status: TIncomeImportFileStatus;
}

export interface IIncomeImportParseResponse {
  files: IIncomeImportFileResult[];
}

export interface IIncomeImportCommitBody {
  rows: IIncomeImportParsedRow[];
}

export interface IIncomeImportCommitResponse {
  createdCount: number;
  refundCount: number;
  shortStays: IPropertyReservation[];
}
