import { buildUrlTabDefinitions, defineUrlTabSchema, resolveUrlTab } from "@/lib/url-tab-state";

export const LEASE_DETAIL_TABS = ["payments", "tenants", "terms"] as const;

export type TLeaseDetailTab = (typeof LEASE_DETAIL_TABS)[number];

export const LEASE_DETAIL_TAB_LABELS: Record<TLeaseDetailTab, string> = {
  payments: "Payments",
  tenants: "Tenants",
  terms: "Terms",
};

export const LEASE_DETAIL_TAB_DEFINITIONS = buildUrlTabDefinitions(
  LEASE_DETAIL_TABS,
  LEASE_DETAIL_TAB_LABELS
);

const leaseDetailTabConfig = defineUrlTabSchema(LEASE_DETAIL_TABS, { defaultTab: "payments" });

export const LEASE_DETAIL_TAB_URL_SCHEMA = leaseDetailTabConfig.schema;

export function resolveLeaseDetailTab(raw: string): TLeaseDetailTab {
  return resolveUrlTab(raw, LEASE_DETAIL_TABS, "payments");
}
