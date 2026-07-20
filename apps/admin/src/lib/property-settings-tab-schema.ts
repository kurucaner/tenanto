import { buildUrlTabDefinitions } from "@/lib/url-tab-state";

export const PROPERTY_SETTINGS_TABS = ["expenses", "income", "taxes", "channels"] as const;

export type TPropertySettingsTab = (typeof PROPERTY_SETTINGS_TABS)[number];

export const PROPERTY_SETTINGS_TAB_LABELS: Record<TPropertySettingsTab, string> = {
  channels: "Channels",
  expenses: "Expenses",
  income: "Income",
  taxes: "Taxes",
};

export const PROPERTY_SETTINGS_TAB_DEFINITIONS = buildUrlTabDefinitions(
  PROPERTY_SETTINGS_TABS,
  PROPERTY_SETTINGS_TAB_LABELS
);
