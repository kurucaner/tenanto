import {
  type IPropertyReservationComputedFields,
  type IPropertyIncomeLineComputedFields,
  type IPropertySettings,
  ReservationChannel,
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

export interface ICalculateStayIncomeInput {
  channel: TReservationChannel;
  cleaningFee: number;
  roomRate: number;
  settings: IPropertySettings;
  unitRentalType: TUnitRentalType;
}

export function calculateStayIncome(
  input: ICalculateStayIncomeInput
): Omit<IPropertyReservationComputedFields, "nights"> {
  const { channel, cleaningFee, roomRate, settings, unitRentalType } = input;

  if (unitRentalType === UnitRentalType.LONG_TERM) {
    const netIncome = roundMoney(roomRate);
    return {
      channelCommission: 0,
      conventionDevelopmentTax: 0,
      grossIncome: netIncome,
      miamiDadeSurtax: 0,
      netIncome,
      resortTax: 0,
      salesTax: 0,
    };
  }

  const taxableBase = roomRate + cleaningFee;
  const salesTax = roundMoney(taxableBase * settings.salesTaxRate);
  const miamiDadeSurtax = roundMoney(taxableBase * settings.miamiDadeSurtaxRate);
  const conventionDevelopmentTax = roundMoney(
    taxableBase * settings.conventionDevelopmentTaxRate
  );
  const resortTax = roundMoney(taxableBase * settings.resortTaxRate);
  const totalTaxes = salesTax + miamiDadeSurtax + conventionDevelopmentTax + resortTax;
  const channelCommission = roundMoney(taxableBase * getChannelCommissionRate(channel, settings));
  const grossIncome = roundMoney(taxableBase + totalTaxes);
  const netIncome = roundMoney(taxableBase - totalTaxes - channelCommission);

  return {
    channelCommission,
    conventionDevelopmentTax,
    grossIncome,
    miamiDadeSurtax,
    netIncome,
    resortTax,
    salesTax,
  };
}

export function calculateMiscIncomeLine(
  amount: number
): IPropertyIncomeLineComputedFields {
  const netIncome = roundMoney(amount);
  return {
    channelCommission: 0,
    conventionDevelopmentTax: 0,
    grossIncome: netIncome,
    miamiDadeSurtax: 0,
    netIncome,
    resortTax: 0,
    salesTax: 0,
  };
}
