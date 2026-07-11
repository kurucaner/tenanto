import {
  getChannelCommissionRateFromRow,
  getResortTaxAmount,
  getStayCommissionBase,
  type IPropertyChannelCommission,
  type IPropertyIncomeLineComputedFields,
  type IPropertyReservationComputedFields,
  type IPropertyTaxBreakdownItem,
  type IPropertyTaxRate,
  sumTaxBreakdown,
  type TUnitRentalType,
  UnitRentalType,
} from "@/packages/shared";

const MS_PER_DAY = 86_400_000;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new TypeError("Invalid check-in or check-out date");
  }
  const nights = Math.round((end - start) / MS_PER_DAY);
  if (nights < 1) {
    throw new Error("Check-out must be after check-in");
  }
  return nights;
}

function buildTaxBreakdown(
  taxableBase: number,
  taxRates: IPropertyTaxRate[]
): IPropertyTaxBreakdownItem[] {
  return taxRates.map((tax) => ({
    amount: roundMoney(taxableBase * tax.rate),
    name: tax.name,
    rate: tax.rate,
    taxRateId: tax.id,
  }));
}

export interface ICalculateStayIncomeInput {
  channelCommission: IPropertyChannelCommission;
  cleaningFee: number;
  nights: number;
  roomTotal: number;
  taxRates: IPropertyTaxRate[];
  unitRentalType: TUnitRentalType;
}

export function calculateStayIncome(
  input: ICalculateStayIncomeInput
): Omit<IPropertyReservationComputedFields, "nights"> {
  const {
    channelCommission: channelCommissionRow,
    cleaningFee,
    roomTotal: inputRoomTotal,
    taxRates,
    unitRentalType,
  } = input;
  const roomTotal = roundMoney(inputRoomTotal);

  if (unitRentalType === UnitRentalType.LONG_TERM) {
    return {
      channelCommission: 0,
      channelCommissionRate: 0,
      grossIncome: roomTotal,
      netIncome: roomTotal,
      taxBreakdown: [],
    };
  }

  const taxableBase = roundMoney(roomTotal + cleaningFee);
  const taxBreakdown = buildTaxBreakdown(taxableBase, taxRates);
  const totalTaxes = sumTaxBreakdown(taxBreakdown);
  const channelCommissionRate = getChannelCommissionRateFromRow(channelCommissionRow);
  const commissionBase = getStayCommissionBase(channelCommissionRow, roomTotal, cleaningFee);
  const channelCommissionAmount = roundMoney(commissionBase * channelCommissionRate);
  const resortAdjustment = channelCommissionRow.excludeResortTaxFromPayout
    ? getResortTaxAmount(taxBreakdown)
    : 0;
  const grossIncome = roundMoney(taxableBase + totalTaxes - resortAdjustment);
  const netIncome = roundMoney(
    taxableBase - totalTaxes - channelCommissionAmount - resortAdjustment
  );

  return {
    channelCommission: channelCommissionAmount,
    channelCommissionRate,
    grossIncome,
    netIncome,
    taxBreakdown,
  };
}

export function calculateMiscIncomeLine(amount: number): IPropertyIncomeLineComputedFields {
  const netIncome = roundMoney(amount);
  return {
    channelCommission: 0,
    grossIncome: netIncome,
    netIncome,
    taxBreakdown: [],
  };
}
