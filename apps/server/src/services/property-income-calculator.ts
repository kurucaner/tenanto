import {
  getChannelCommissionRate,
  getResortTaxAmount,
  getStayCommissionBase,
  type IPropertyIncomeLineComputedFields,
  type IPropertyReservationComputedFields,
  type IPropertySettings,
  type IPropertyTaxBreakdownItem,
  type IPropertyTaxRate,
  ReservationChannel,
  sumTaxBreakdown,
  type TReservationChannel,
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
  channel: TReservationChannel;
  cleaningFee: number;
  nights: number;
  roomTotal: number;
  settings: IPropertySettings;
  taxRates: IPropertyTaxRate[];
  unitRentalType: TUnitRentalType;
}

export function calculateStayIncome(
  input: ICalculateStayIncomeInput
): Omit<IPropertyReservationComputedFields, "nights"> {
  const { channel, cleaningFee, roomTotal: inputRoomTotal, settings, taxRates, unitRentalType } =
    input;
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
  const channelCommissionRate = getChannelCommissionRate(channel, settings);
  const commissionBase = getStayCommissionBase(channel, roomTotal, cleaningFee);
  const channelCommission = roundMoney(commissionBase * channelCommissionRate);
  // Airbnb remits the resort tax directly, so it is excluded from the host's gross and
  // withheld from the payout (netIncome). Other channels keep the standard formula.
  const resortAdjustment =
    channel === ReservationChannel.AIRBNB ? getResortTaxAmount(taxBreakdown) : 0;
  const grossIncome = roundMoney(taxableBase + totalTaxes - resortAdjustment);
  const netIncome = roundMoney(taxableBase - totalTaxes - channelCommission - resortAdjustment);

  return {
    channelCommission,
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
