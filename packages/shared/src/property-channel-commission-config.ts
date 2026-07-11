export interface IPropertyChannelCommission {
  excludeCleaningFromCommissionBase: boolean;
  excludeResortTaxFromPayout: boolean;
  id: string;
  name: string;
  propertyId: string;
  rate: number;
  sortOrder: number;
}

export interface IPropertyChannelCommissionInput {
  excludeCleaningFromCommissionBase?: boolean;
  excludeResortTaxFromPayout?: boolean;
  id?: string;
  name: string;
  rate: number;
  sortOrder: number;
}

export const DEFAULT_PROPERTY_CHANNEL_COMMISSIONS: Pick<
  IPropertyChannelCommissionInput,
  "excludeCleaningFromCommissionBase" | "excludeResortTaxFromPayout" | "name" | "rate"
>[] = [
  {
    excludeCleaningFromCommissionBase: false,
    excludeResortTaxFromPayout: true,
    name: "Airbnb",
    rate: 0.155,
  },
  {
    excludeCleaningFromCommissionBase: false,
    excludeResortTaxFromPayout: false,
    name: "Booking.com",
    rate: 0.15,
  },
  {
    excludeCleaningFromCommissionBase: true,
    excludeResortTaxFromPayout: false,
    name: "Expedia",
    rate: 0.15,
  },
  {
    excludeCleaningFromCommissionBase: false,
    excludeResortTaxFromPayout: false,
    name: "Direct web / merchant",
    rate: 0.035,
  },
];
