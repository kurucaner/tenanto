import {
  PROPERTY_SETTINGS_NAME_MAX_LENGTH,
  type PropertyChannelCommissionFormRow,
  type PropertyExpenseCategoryTypeFormRow,
  type PropertyIncomeLineTypeFormRow,
  type PropertyTaxRateFormRow,
} from "@/lib/property-settings-form-types";
import {
  formatRateAsPercent,
  type IPropertyChannelCommission,
  type IPropertyChannelCommissionInput,
  type IPropertyExpenseCategoryType,
  type IPropertyExpenseCategoryTypeInput,
  type IPropertyIncomeLineType,
  type IPropertyIncomeLineTypeInput,
  type IPropertySettings,
  type IPropertyTaxRate,
  type IPropertyTaxRateInput,
  type IUpdatePropertySettingsBody,
  percentToRate,
} from "@/packages/shared";

export type {
  PropertyChannelCommissionFormRow,
  PropertyExpenseCategoryTypeFormRow,
  PropertyIncomeLineTypeFormRow,
  PropertyTaxRateFormRow,
} from "@/lib/property-settings-form-types";

export type TPropertySettingsFormState = {
  channelCommissions: PropertyChannelCommissionFormRow[];
  expenseCategoryTypes: PropertyExpenseCategoryTypeFormRow[];
  incomeLineTypes: PropertyIncomeLineTypeFormRow[];
  taxRates: PropertyTaxRateFormRow[];
};

export type TPropertySettingsListSection =
  "channelCommissions" | "expenseCategoryTypes" | "incomeLineTypes" | "taxRates";

const MAX_TAX_NAME_LENGTH = PROPERTY_SETTINGS_NAME_MAX_LENGTH;
const MAX_INCOME_TYPE_NAME_LENGTH = PROPERTY_SETTINGS_NAME_MAX_LENGTH;
const MAX_EXPENSE_CATEGORY_NAME_LENGTH = PROPERTY_SETTINGS_NAME_MAX_LENGTH;
const MAX_CHANNEL_NAME_LENGTH = PROPERTY_SETTINGS_NAME_MAX_LENGTH;

const parsePercent = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
};

export type TValidationResult = { error: string; ok: false } | { ok: true };

const taxRateToFormRow = (tax: IPropertyTaxRate): PropertyTaxRateFormRow => ({
  clientId: tax.id,
  id: tax.id,
  name: tax.name,
  ratePercent: formatRateAsPercent(tax.rate),
});

const channelCommissionToFormRow = (
  channel: IPropertyChannelCommission
): PropertyChannelCommissionFormRow => ({
  clientId: channel.id,
  excludeCleaningFromCommissionBase: channel.excludeCleaningFromCommissionBase,
  excludeResortTaxFromPayout: channel.excludeResortTaxFromPayout,
  id: channel.id,
  name: channel.name,
  ratePercent: formatRateAsPercent(channel.rate),
});

const incomeLineTypeToFormRow = (type: IPropertyIncomeLineType): PropertyIncomeLineTypeFormRow => ({
  clientId: type.id,
  id: type.id,
  name: type.name,
});

const expenseCategoryTypeToFormRow = (
  type: IPropertyExpenseCategoryType
): PropertyExpenseCategoryTypeFormRow => ({
  clientId: type.id,
  id: type.id,
  isAnnualAmount: type.isAnnualAmount,
  name: type.name,
});

export const settingsToFormState = (settings: IPropertySettings): TPropertySettingsFormState => ({
  channelCommissions: settings.channelCommissions.map(channelCommissionToFormRow),
  expenseCategoryTypes: settings.expenseCategoryTypes.map(expenseCategoryTypeToFormRow),
  incomeLineTypes: settings.incomeLineTypes.map(incomeLineTypeToFormRow),
  taxRates: settings.taxRates.map(taxRateToFormRow),
});

const formTaxRatesToBody = (taxRates: PropertyTaxRateFormRow[]): IPropertyTaxRateInput[] =>
  taxRates.map((row, index) => ({
    ...(row.id == null ? {} : { id: row.id }),
    name: row.name.trim(),
    rate: percentToRate(Number(row.ratePercent)),
    sortOrder: index,
  }));

const formChannelCommissionsToBody = (
  channelCommissions: PropertyChannelCommissionFormRow[]
): IPropertyChannelCommissionInput[] =>
  channelCommissions.map((row, index) => ({
    ...(row.id == null ? {} : { id: row.id }),
    excludeCleaningFromCommissionBase: row.excludeCleaningFromCommissionBase,
    excludeResortTaxFromPayout: row.excludeResortTaxFromPayout,
    name: row.name.trim(),
    rate: percentToRate(Number(row.ratePercent)),
    sortOrder: index,
  }));

const formIncomeLineTypesToBody = (
  incomeLineTypes: PropertyIncomeLineTypeFormRow[]
): IPropertyIncomeLineTypeInput[] =>
  incomeLineTypes.map((row, index) => ({
    ...(row.id == null ? {} : { id: row.id }),
    name: row.name.trim(),
    sortOrder: index,
  }));

const formExpenseCategoryTypesToBody = (
  expenseCategoryTypes: PropertyExpenseCategoryTypeFormRow[]
): IPropertyExpenseCategoryTypeInput[] =>
  expenseCategoryTypes.map((row, index) => ({
    ...(row.id == null ? {} : { id: row.id }),
    isAnnualAmount: row.isAnnualAmount,
    name: row.name.trim(),
    sortOrder: index,
  }));

export const formStateToBody = (form: TPropertySettingsFormState): IUpdatePropertySettingsBody => ({
  channelCommissions: formChannelCommissionsToBody(form.channelCommissions),
  expenseCategoryTypes: formExpenseCategoryTypesToBody(form.expenseCategoryTypes),
  incomeLineTypes: formIncomeLineTypesToBody(form.incomeLineTypes),
  taxRates: formTaxRatesToBody(form.taxRates),
});

export const hasNewRows = (rows: { id?: string }[]): boolean => rows.some((row) => row.id == null);

export const expenseCategoryTypesDiffer = (
  current: PropertyExpenseCategoryTypeFormRow[],
  saved: PropertyExpenseCategoryTypeFormRow[]
): boolean =>
  JSON.stringify(formExpenseCategoryTypesToBody(current)) !==
  JSON.stringify(formExpenseCategoryTypesToBody(saved));

export const taxRatesDiffer = (
  current: PropertyTaxRateFormRow[],
  saved: PropertyTaxRateFormRow[]
): boolean =>
  JSON.stringify(formTaxRatesToBody(current)) !== JSON.stringify(formTaxRatesToBody(saved));

export const channelCommissionsDiffer = (
  current: PropertyChannelCommissionFormRow[],
  saved: PropertyChannelCommissionFormRow[]
): boolean =>
  JSON.stringify(formChannelCommissionsToBody(current)) !==
  JSON.stringify(formChannelCommissionsToBody(saved));

export const validateChannelCommissions = (
  channelCommissions: PropertyChannelCommissionFormRow[]
): TValidationResult => {
  const seenChannelNames = new Set<string>();
  for (const row of channelCommissions) {
    const name = row.name.trim();
    if (name.length === 0) {
      return { error: "Each channel must have a name", ok: false };
    }
    if (name.length > MAX_CHANNEL_NAME_LENGTH) {
      return {
        error: `Channel names must be at most ${MAX_CHANNEL_NAME_LENGTH} characters`,
        ok: false,
      };
    }
    const normalized = name.toLowerCase();
    if (seenChannelNames.has(normalized)) {
      return { error: "Channel names must be unique", ok: false };
    }
    seenChannelNames.add(normalized);

    if (parsePercent(row.ratePercent) === null) {
      return { error: "All channel commission rates must be numbers between 0 and 100", ok: false };
    }
  }
  return { ok: true };
};

export const validateTaxRates = (taxRates: PropertyTaxRateFormRow[]): TValidationResult => {
  const seenTaxNames = new Set<string>();
  for (const row of taxRates) {
    const name = row.name.trim();
    if (name.length === 0) {
      return { error: "Each tax must have a name", ok: false };
    }
    if (name.length > MAX_TAX_NAME_LENGTH) {
      return { error: `Tax names must be at most ${MAX_TAX_NAME_LENGTH} characters`, ok: false };
    }
    const normalized = name.toLowerCase();
    if (seenTaxNames.has(normalized)) {
      return { error: "Tax names must be unique", ok: false };
    }
    seenTaxNames.add(normalized);

    if (parsePercent(row.ratePercent) === null) {
      return { error: "All tax rates must be numbers between 0 and 100", ok: false };
    }
  }
  return { ok: true };
};

export const validateIncomeLineTypes = (
  incomeLineTypes: PropertyIncomeLineTypeFormRow[]
): TValidationResult => {
  const seenIncomeTypeNames = new Set<string>();
  for (const row of incomeLineTypes) {
    const name = row.name.trim();
    if (name.length === 0) {
      return { error: "Each other income type must have a name", ok: false };
    }
    if (name.length > MAX_INCOME_TYPE_NAME_LENGTH) {
      return {
        error: `Income type names must be at most ${MAX_INCOME_TYPE_NAME_LENGTH} characters`,
        ok: false,
      };
    }
    const normalized = name.toLowerCase();
    if (seenIncomeTypeNames.has(normalized)) {
      return { error: "Income type names must be unique", ok: false };
    }
    seenIncomeTypeNames.add(normalized);
  }
  return { ok: true };
};

export const validateExpenseCategoryTypes = (
  expenseCategoryTypes: PropertyExpenseCategoryTypeFormRow[]
): TValidationResult => {
  const seenExpenseCategoryNames = new Set<string>();
  for (const row of expenseCategoryTypes) {
    const name = row.name.trim();
    if (name.length === 0) {
      return { error: "Each expense category must have a name", ok: false };
    }
    if (name.length > MAX_EXPENSE_CATEGORY_NAME_LENGTH) {
      return {
        error: `Expense category names must be at most ${MAX_EXPENSE_CATEGORY_NAME_LENGTH} characters`,
        ok: false,
      };
    }
    const normalized = name.toLowerCase();
    if (seenExpenseCategoryNames.has(normalized)) {
      return { error: "Expense category names must be unique", ok: false };
    }
    seenExpenseCategoryNames.add(normalized);
  }
  return { ok: true };
};

export const validatePropertySettingsForm = (
  form: TPropertySettingsFormState
): TValidationResult => {
  const channelResult = validateChannelCommissions(form.channelCommissions);
  if (!channelResult.ok) return channelResult;

  const taxResult = validateTaxRates(form.taxRates);
  if (!taxResult.ok) return taxResult;

  const incomeResult = validateIncomeLineTypes(form.incomeLineTypes);
  if (!incomeResult.ok) return incomeResult;

  return validateExpenseCategoryTypes(form.expenseCategoryTypes);
};

export const validatePropertySettingsSection = (
  section: TPropertySettingsListSection,
  form: TPropertySettingsFormState
): TValidationResult => {
  switch (section) {
    case "channelCommissions":
      return validateChannelCommissions(form.channelCommissions);
    case "expenseCategoryTypes":
      return validateExpenseCategoryTypes(form.expenseCategoryTypes);
    case "incomeLineTypes":
      return validateIncomeLineTypes(form.incomeLineTypes);
    case "taxRates":
      return validateTaxRates(form.taxRates);
  }
};

export const buildSectionPatchBody = (
  section: TPropertySettingsListSection,
  form: TPropertySettingsFormState
): IUpdatePropertySettingsBody => {
  switch (section) {
    case "channelCommissions":
      return { channelCommissions: formChannelCommissionsToBody(form.channelCommissions) };
    case "expenseCategoryTypes":
      return { expenseCategoryTypes: formExpenseCategoryTypesToBody(form.expenseCategoryTypes) };
    case "incomeLineTypes":
      return { incomeLineTypes: formIncomeLineTypesToBody(form.incomeLineTypes) };
    case "taxRates":
      return { taxRates: formTaxRatesToBody(form.taxRates) };
  }
};

export const mergeSavedSectionIntoForm = (
  prev: TPropertySettingsFormState,
  settings: IPropertySettings,
  section: TPropertySettingsListSection
): TPropertySettingsFormState => {
  switch (section) {
    case "channelCommissions":
      return {
        ...prev,
        channelCommissions: settings.channelCommissions.map(channelCommissionToFormRow),
      };
    case "expenseCategoryTypes":
      return {
        ...prev,
        expenseCategoryTypes: settings.expenseCategoryTypes.map(expenseCategoryTypeToFormRow),
      };
    case "incomeLineTypes":
      return {
        ...prev,
        incomeLineTypes: settings.incomeLineTypes.map(incomeLineTypeToFormRow),
      };
    case "taxRates":
      return {
        ...prev,
        taxRates: settings.taxRates.map(taxRateToFormRow),
      };
  }
};

export const sectionSaveSuccessMessage: Record<TPropertySettingsListSection, string> = {
  channelCommissions: "Channel commissions saved",
  expenseCategoryTypes: "Expense categories saved",
  incomeLineTypes: "Income types saved",
  taxRates: "Tax rates saved",
};
