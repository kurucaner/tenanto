import { type IPropertyChannelCommission } from "./property-channel-commission-config";
import { calculateNights, calculateStayIncome } from "./property-income-calculator";
import { type IIncomeImportParsedRow } from "./property-income-import-types";
import { sumTaxBreakdown } from "./property-income-utils";
import { ReservationStatus } from "./property-reservation-types";
import { type IPropertyTaxBreakdownItem, type IPropertyTaxRate } from "./property-settings-types";
import { type IPropertyUnit, UnitRentalType } from "./property-types";

export interface IIncomeImportPreviewContext {
  channels: IPropertyChannelCommission[];
  taxRates: IPropertyTaxRate[];
  units: IPropertyUnit[];
}

export const INCOME_IMPORT_COMMIT_STATUSES = [
  ReservationStatus.STAYED,
  ReservationStatus.CANCELED,
  ReservationStatus.NO_SHOW,
] as const;

export function recomputeIncomeImportPreviewRow(
  row: IIncomeImportParsedRow,
  context: IIncomeImportPreviewContext
): IIncomeImportParsedRow {
  const errors: string[] = [];
  const guestName = row.guestName.trim();

  if (!guestName) {
    errors.push("Guest name is required");
  }

  const unit = context.units.find((candidate) => candidate.id === row.unitId);
  if (!row.unitId) {
    errors.push("Unit is required");
  } else if (!unit) {
    errors.push("Unit not found");
  } else if (unit.isDeleted) {
    errors.push(`Unit "${unit.unitNumber}" has been deleted`);
  } else if (unit.rentalType !== UnitRentalType.SHORT_TERM) {
    errors.push(`Unit "${unit.unitNumber}" is not a short-term unit`);
  }

  const channel = context.channels.find((candidate) => candidate.id === row.channelCommissionId);
  if (!row.channelCommissionId) {
    errors.push("Channel is required");
  } else if (!channel) {
    errors.push("Channel not found");
  }

  let status = row.status;
  const refunded = row.refunded;

  if (refunded && (status === ReservationStatus.CANCELED || status === ReservationStatus.NO_SHOW)) {
    errors.push("Refunded stays cannot be canceled or no-show");
  }

  if (refunded && status !== ReservationStatus.STAYED) {
    errors.push('Refunded stays must have status "stayed"');
  }

  if (
    !refunded &&
    !INCOME_IMPORT_COMMIT_STATUSES.includes(
      status as (typeof INCOME_IMPORT_COMMIT_STATUSES)[number]
    )
  ) {
    errors.push("Status must be stayed, canceled, or no-show");
  }

  if (!Number.isFinite(row.roomTotal) || row.roomTotal < 0) {
    errors.push("Room total must be a non-negative number");
  }

  if (!Number.isFinite(row.cleaningFee) || row.cleaningFee < 0) {
    errors.push("Cleaning fee must be a non-negative number");
  }

  if (!row.checkIn || !row.checkOut) {
    errors.push("Check-in and check-out are required");
  }

  let computedNights: number | undefined;
  let nights = row.nights;
  try {
    if (row.checkIn && row.checkOut) {
      computedNights = calculateNights(row.checkIn, row.checkOut);
      nights = computedNights;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Invalid stay dates");
  }

  let computedIncome:
    | {
        channelCommission: number;
        channelCommissionRate: number;
        grossIncome: number;
        netIncome: number;
        taxBreakdown: IPropertyTaxBreakdownItem[];
      }
    | undefined;

  if (unit && channel && computedNights !== undefined) {
    computedIncome = calculateStayIncome({
      channelCommission: channel,
      cleaningFee: row.cleaningFee,
      nights: computedNights,
      roomTotal: row.roomTotal,
      taxRates: context.taxRates,
      unitRentalType: unit.rentalType,
    });
  }

  return {
    ...row,
    channelCommission: computedIncome?.channelCommission,
    channelCommissionRate: computedIncome?.channelCommissionRate,
    channelName: channel?.name ?? row.channelName,
    computedNights,
    grossIncome: computedIncome?.grossIncome,
    guestName,
    netIncome: computedIncome?.netIncome,
    nights,
    refunded,
    roomNo: unit?.unitNumber ?? row.roomNo,
    status,
    taxBreakdown: computedIncome?.taxBreakdown,
    validationError: errors.length > 0 ? errors.join(". ") : undefined,
  };
}

export function getIncomeImportPreviewTaxesTotal(row: IIncomeImportParsedRow): number | null {
  if (!row.taxBreakdown) {
    return null;
  }
  return sumTaxBreakdown(row.taxBreakdown);
}
