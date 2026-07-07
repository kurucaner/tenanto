import {
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
    throw new Error("Invalid check-in or check-out date");
  }
  const nights = Math.round((end - start) / MS_PER_DAY);
  if (nights < 1) {
    throw new Error("Check-out must be after check-in");
  }
  return nights;
}

function getChannelCommissionRate(
  channel: TReservationChannel,
  settings: IPropertySettings
): number {
  switch (channel) {
    case ReservationChannel.AIRBNB:
      return settings.airbnbCommissionRate;
    case ReservationChannel.BOOKING:
      return settings.bookingCommissionRate;
    case ReservationChannel.EXPEDIA:
      return settings.expediaCommissionRate;
    case ReservationChannel.DIRECT:
      return settings.directCommissionRate;
  }
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
  roomRate: number;
  settings: IPropertySettings;
  taxRates: IPropertyTaxRate[];
  unitRentalType: TUnitRentalType;
}

export function calculateStayIncome(
  input: ICalculateStayIncomeInput
): Omit<IPropertyReservationComputedFields, "nights"> {
  const { channel, cleaningFee, nights, roomRate, settings, taxRates, unitRentalType } = input;
  const roomTotal = roundMoney(roomRate * nights);

  if (unitRentalType === UnitRentalType.LONG_TERM) {
    return {
      channelCommission: 0,
      grossIncome: roomTotal,
      netIncome: roomTotal,
      taxBreakdown: [],
    };
  }

  const taxableBase = roundMoney(roomTotal + cleaningFee);
  const taxBreakdown = buildTaxBreakdown(taxableBase, taxRates);
  const totalTaxes = sumTaxBreakdown(taxBreakdown);
  const channelCommission = roundMoney(taxableBase * getChannelCommissionRate(channel, settings));
  const grossIncome = roundMoney(taxableBase + totalTaxes);
  const netIncome = roundMoney(taxableBase - totalTaxes - channelCommission);

  return {
    channelCommission,
    grossIncome,
    netIncome,
    taxBreakdown,
  };
}

export function calculateMiscIncomeLine(
  amount: number
): IPropertyIncomeLineComputedFields {
  const netIncome = roundMoney(amount);
  return {
    channelCommission: 0,
    grossIncome: netIncome,
    netIncome,
    taxBreakdown: [],
  };
}
