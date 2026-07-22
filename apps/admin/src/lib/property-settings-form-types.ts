export interface PropertyChannelCommissionFormRow {
  clientId: string;
  excludeCleaningFromCommissionBase: boolean;
  excludeResortTaxFromPayout: boolean;
  id?: string;
  name: string;
  ratePercent: string;
}

export interface PropertyExpenseCategoryTypeFormRow {
  clientId: string;
  id?: string;
  isAnnualAmount: boolean;
  isSystem?: boolean;
  name: string;
}

export interface PropertyIncomeLineTypeFormRow {
  clientId: string;
  id?: string;
  name: string;
}

export interface PropertyTaxRateFormRow {
  clientId: string;
  id?: string;
  name: string;
  ratePercent: string;
}

export function createPropertySettingsClientId(): string {
  return crypto.randomUUID();
}

export const PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD = 8;

export const PROPERTY_SETTINGS_NAME_MAX_LENGTH = 80;
