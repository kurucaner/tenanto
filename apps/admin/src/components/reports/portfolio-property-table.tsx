import { memo } from "react";
import { Link } from "react-router-dom";

import { ReportSectionTable } from "@/components/reports/report-section-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format-money";
import { buildPropertyReportsPath,formatReportPercent } from "@/lib/report-date-defaults";
import type { IPortfolioPropertyReportRow } from "@/packages/shared";

interface PortfolioPropertyTableProps {
  from: string;
  properties: IPortfolioPropertyReportRow[];
  rentalType?: string;
  to: string;
}

function aggregateOccupancy(row: IPortfolioPropertyReportRow): number {
  const { byUnit } = row.summary;
  if (byUnit.length === 0) return 0;
  const bookedNights = byUnit.reduce((sum, unit) => sum + unit.bookedNights, 0);
  const availableNights = byUnit.reduce((sum, unit) => sum + unit.availableNights, 0);
  return availableNights > 0 ? bookedNights / availableNights : 0;
}

function aggregateAdr(row: IPortfolioPropertyReportRow): number {
  const { byUnit } = row.summary;
  if (byUnit.length === 0) return 0;
  const totalRevenue = byUnit.reduce((sum, unit) => sum + unit.adr * unit.bookedNights, 0);
  const bookedNights = byUnit.reduce((sum, unit) => sum + unit.bookedNights, 0);
  return bookedNights > 0 ? totalRevenue / bookedNights : 0;
}

export const PortfolioPropertyTable = memo(
  ({ from, properties, rentalType, to }: PortfolioPropertyTableProps) => (
    <ReportSectionTable
      columns={[
        "Property",
        "Net income",
        "Expenses",
        "Operational net",
        "Occupancy",
        "ADR",
      ]}
      isEmpty={properties.length === 0}
      title="Per-property breakdown"
    >
      {properties.map((row) => (
        <TableRow key={row.propertyId}>
          <TableCell>
            <Link
              className="font-medium text-foreground hover:underline"
              to={buildPropertyReportsPath(row.propertyId, from, to, rentalType)}
            >
              {row.propertyName}
            </Link>
          </TableCell>
          <TableCell className="text-right">{formatMoney(row.summary.totals.netIncome)}</TableCell>
          <TableCell className="text-right">
            {formatMoney(row.summary.totals.totalExpenses)}
          </TableCell>
          <TableCell className="text-right">
            {formatMoney(row.summary.totals.operationalNet)}
          </TableCell>
          <TableCell className="text-right">{formatReportPercent(aggregateOccupancy(row))}</TableCell>
          <TableCell className="text-right">{formatMoney(aggregateAdr(row))}</TableCell>
        </TableRow>
      ))}
    </ReportSectionTable>
  )
);
PortfolioPropertyTable.displayName = "PortfolioPropertyTable";
