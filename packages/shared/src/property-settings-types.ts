export interface IPropertySettings {
  airbnbCommissionRate: number;
  bookingCommissionRate: number;
  conventionDevelopmentTaxRate: number;
  createdAt: string;
  directCommissionRate: number;
  expediaCommissionRate: number;
  miamiDadeSurtaxRate: number;
  propertyId: string;
  resortTaxRate: number;
  salesTaxRate: number;
  updatedAt: string;
}

export interface IPropertySettingsDefaults {
  airbnbCommissionRate: number;
  bookingCommissionRate: number;
  conventionDevelopmentTaxRate: number;
  directCommissionRate: number;
  expediaCommissionRate: number;
  miamiDadeSurtaxRate: number;
  resortTaxRate: number;
  salesTaxRate: number;
}

export const DEFAULT_PROPERTY_SETTINGS: IPropertySettingsDefaults = {
  airbnbCommissionRate: 0.155,
  bookingCommissionRate: 0.15,
  conventionDevelopmentTaxRate: 0.03,
  directCommissionRate: 0.035,
  expediaCommissionRate: 0.15,
  miamiDadeSurtaxRate: 0.01,
  resortTaxRate: 0.04,
  salesTaxRate: 0.06,
};

export interface IUpdatePropertySettingsBody {
  airbnbCommissionRate?: number;
  bookingCommissionRate?: number;
  conventionDevelopmentTaxRate?: number;
  directCommissionRate?: number;
  expediaCommissionRate?: number;
  miamiDadeSurtaxRate?: number;
  resortTaxRate?: number;
  salesTaxRate?: number;
}

export const rateToPercent = (rate: number): number => rate * 100;

export const percentToRate = (percent: number): number => percent / 100;
