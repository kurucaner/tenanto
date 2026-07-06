import { memo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format-money";
import type { IPropertyReportTotals } from "@/packages/shared";

interface ReportSummaryCardsProps {
  totals: IPropertyReportTotals;
}

const SUMMARY_ITEMS: { key: keyof IPropertyReportTotals; label: string }[] = [
  { key: "grossIncome", label: "Gross income" },
  { key: "netIncome", label: "Net income" },
  { key: "totalExpenses", label: "Total expenses" },
  { key: "operationalNet", label: "Operational net" },
];

export const ReportSummaryCards = memo(({ totals }: ReportSummaryCardsProps) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {SUMMARY_ITEMS.map((item) => (
      <Card key={item.key}>
        <CardContent className="space-y-1 p-4">
          <p className="text-muted-foreground text-xs">{item.label}</p>
          <p className="text-lg font-semibold">{formatMoney(totals[item.key])}</p>
        </CardContent>
      </Card>
    ))}
  </div>
));
ReportSummaryCards.displayName = "ReportSummaryCards";
