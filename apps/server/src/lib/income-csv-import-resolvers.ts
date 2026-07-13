import {
  type IIncomeCsvExtractedRow,
  type IIncomeImportParsedRow,
  type IPropertyChannelCommission,
  type IPropertyTaxRate,
  type IPropertyUnit,
  ReservationStatus,
  UnitRentalType,
} from "@/packages/shared";
import { calculateNights, calculateStayIncome } from "@/services/property-income-calculator";

const CHANNEL_LOOKUP_ALIASES: Record<string, readonly string[]> = {
  airbnb: ["airbnb"],
  booking: ["booking.com", "booking"],
  direct: ["direct web / merchant", "direct"],
  "expedia ec": ["expedia"],
  "expedia hc": ["expedia"],
};

export interface IIncomeCsvImportContext {
  channels: IPropertyChannelCommission[];
  taxRates: IPropertyTaxRate[];
  units: IPropertyUnit[];
}

export function resolveUnitByRoomNo(
  roomNo: string,
  units: IPropertyUnit[]
): IPropertyUnit | undefined {
  const normalizedRoomNo = roomNo.trim().toLowerCase();
  return units.find((unit) => unit.unitNumber.trim().toLowerCase() === normalizedRoomNo);
}

export function resolveChannelByCsvName(
  channelName: string,
  channels: IPropertyChannelCommission[]
): IPropertyChannelCommission | undefined {
  const normalizedCsvName = channelName.trim().toLowerCase();
  const exactMatch = channels.find(
    (channel) => channel.name.trim().toLowerCase() === normalizedCsvName
  );
  if (exactMatch) {
    return exactMatch;
  }

  const aliasTargets = CHANNEL_LOOKUP_ALIASES[normalizedCsvName];
  if (aliasTargets) {
    for (const alias of aliasTargets) {
      const aliasMatch = channels.find((channel) => channel.name.trim().toLowerCase() === alias);
      if (aliasMatch) {
        return aliasMatch;
      }
    }

    if (normalizedCsvName.startsWith("expedia")) {
      const expediaChannels = channels.filter((channel) =>
        channel.name.trim().toLowerCase().includes("expedia")
      );
      if (expediaChannels.length === 1) {
        return expediaChannels[0];
      }
    }
  }

  return undefined;
}

export function buildIncomeImportParsedRow(
  extracted: IIncomeCsvExtractedRow,
  context: IIncomeCsvImportContext
): IIncomeImportParsedRow {
  const errors: string[] = [];
  const unit = resolveUnitByRoomNo(extracted.roomNo, context.units);

  if (!unit) {
    errors.push(`Unit "${extracted.roomNo}" not found`);
  } else if (unit.isDeleted) {
    errors.push(`Unit "${extracted.roomNo}" has been deleted`);
  } else if (unit.rentalType !== UnitRentalType.SHORT_TERM) {
    errors.push(`Unit "${extracted.roomNo}" is not a short-term unit`);
  }

  const channel = resolveChannelByCsvName(extracted.channelName, context.channels);
  if (!channel) {
    errors.push(`Channel "${extracted.channelName}" not found`);
  }

  if (
    extracted.refunded &&
    (extracted.status === ReservationStatus.CANCELED ||
      extracted.status === ReservationStatus.NO_SHOW)
  ) {
    errors.push("Refunded stays cannot be canceled or no-show");
  }

  if (extracted.refunded && extracted.status !== ReservationStatus.STAYED) {
    errors.push('Refunded stays must have status "stayed"');
  }

  let computedNights: number | undefined;
  try {
    computedNights = calculateNights(extracted.checkIn, extracted.checkOut);
    if (computedNights !== extracted.nights) {
      errors.push(
        `Nights (${extracted.nights}) do not match stay dates (${computedNights} nights)`
      );
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
        taxBreakdown: IIncomeImportParsedRow["taxBreakdown"];
      }
    | undefined;

  if (unit && channel && computedNights !== undefined) {
    computedIncome = calculateStayIncome({
      channelCommission: channel,
      cleaningFee: extracted.cleaningFee,
      nights: computedNights,
      roomTotal: extracted.roomTotal,
      taxRates: context.taxRates,
      unitRentalType: unit.rentalType,
    });
  }

  return {
    channelCommission: computedIncome?.channelCommission,
    channelCommissionId: channel?.id ?? "",
    channelCommissionRate: computedIncome?.channelCommissionRate,
    channelName: extracted.channelName,
    checkIn: extracted.checkIn,
    checkOut: extracted.checkOut,
    cleaningFee: extracted.cleaningFee,
    computedNights,
    grossIncome: computedIncome?.grossIncome,
    guestName: extracted.guestName,
    netIncome: computedIncome?.netIncome,
    nights: extracted.nights,
    refunded: extracted.refunded,
    roomNo: extracted.roomNo,
    roomTotal: extracted.roomTotal,
    rowIndex: extracted.rowIndex,
    sourceFileName: extracted.sourceFileName,
    status: extracted.status,
    taxBreakdown: computedIncome?.taxBreakdown,
    unitId: unit?.id ?? "",
    validationError: errors.length > 0 ? errors.join(". ") : undefined,
  };
}
