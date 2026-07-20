import { formatMoney } from "@/lib/format-money";
import { type IHomeFinancialOverview } from "@/packages/shared";

export function formatHomePortfolioReportsKpi(overview: IHomeFinancialOverview): string | null {
  if (overview.propertyCount === 0) {
    return null;
  }

  return `Operational net ${formatMoney(overview.totals.operationalNet)} · Last 6 months`;
}
