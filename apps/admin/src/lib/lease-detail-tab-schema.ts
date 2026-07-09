import { defineUrlFilterSchema } from "@/lib/url-search-params";

export const LEASE_DETAIL_TABS = ["overview", "tenants", "payments", "terms"] as const;

export type TLeaseDetailTab = (typeof LEASE_DETAIL_TABS)[number];

export const LEASE_DETAIL_TAB_LABELS: Record<TLeaseDetailTab, string> = {
  overview: "Overview",
  payments: "Payments",
  tenants: "Tenants",
  terms: "Terms",
};

export const LEASE_DETAIL_TAB_URL_SCHEMA = defineUrlFilterSchema<{ tab: string }>({
  tab: { defaultValue: "overview" },
});

export function resolveLeaseDetailTab(raw: string): TLeaseDetailTab {
  if ((LEASE_DETAIL_TABS as readonly string[]).includes(raw)) {
    return raw as TLeaseDetailTab;
  }
  return "overview";
}
