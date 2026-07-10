export interface IPropertyTaxRate {
  id: string;
  name: string;
  propertyId: string;
  rate: number;
  sortOrder: number;
}

export interface IPropertyTaxRateInput {
  id?: string;
  name: string;
  rate: number;
  sortOrder: number;
}

export interface IPropertyTaxBreakdownItem {
  amount: number;
  name: string;
  rate: number;
  taxRateId: string;
}

// Name of the resort tax line. Airbnb income excludes this tax from gross/net payout;
// it is matched by name since tax rates have no stable type/category.
export const RESORT_TAX_NAME = "Resort tax";

export const DEFAULT_PROPERTY_TAX_RATES: Pick<IPropertyTaxRateInput, "name" | "rate">[] = [
  { name: "Sales tax", rate: 0.06 },
  { name: RESORT_TAX_NAME, rate: 0.04 },
];

import type {
  IPropertyExpenseCategoryType,
  IPropertyExpenseCategoryTypeInput,
} from "./property-expense-category-type-config";
import type {
  IPropertyIncomeLineType,
  IPropertyIncomeLineTypeInput,
} from "./property-income-line-type-config";

export interface IPropertySettings {
  airbnbCommissionRate: number;
  bookingCommissionRate: number;
  createdAt: string;
  directCommissionRate: number;
  expediaCommissionRate: number;
  expenseCategoryTypes: IPropertyExpenseCategoryType[];
  incomeLineTypes: IPropertyIncomeLineType[];
  propertyId: string;
  taxRates: IPropertyTaxRate[];
  updatedAt: string;
}

export interface IPropertySettingsDefaults {
  airbnbCommissionRate: number;
  bookingCommissionRate: number;
  directCommissionRate: number;
  expediaCommissionRate: number;
}

export const DEFAULT_PROPERTY_SETTINGS: IPropertySettingsDefaults = {
  airbnbCommissionRate: 0.155,
  bookingCommissionRate: 0.15,
  directCommissionRate: 0.035,
  expediaCommissionRate: 0.15,
};

export interface IUpdatePropertySettingsBody {
  airbnbCommissionRate?: number;
  bookingCommissionRate?: number;
  directCommissionRate?: number;
  expediaCommissionRate?: number;
  expenseCategoryTypes?: IPropertyExpenseCategoryTypeInput[];
  incomeLineTypes?: IPropertyIncomeLineTypeInput[];
  taxRates?: IPropertyTaxRateInput[];
}

export const rateToPercent = (rate: number): number => Math.round(rate * 100 * 1000) / 1000;

export const percentToRate = (percent: number): number => percent / 100;

/** Formats a decimal rate (e.g. 0.035) as a clean percent string (e.g. "3.5"). */
export const formatRateAsPercent = (rate: number): string =>
  parseFloat(rateToPercent(rate).toFixed(3)).toString();
