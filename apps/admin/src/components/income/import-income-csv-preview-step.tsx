import { AlertCircle } from "lucide-react";
import { memo } from "react";

import { formatStatusLabel } from "@/components/income/reservation-form-options";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format-money";
import { type IIncomeImportParsedRow } from "@/packages/shared";

interface ImportIncomeCsvPreviewStepProps {
  rows: IIncomeImportParsedRow[];
}

function formatPreviewDateRange(row: IIncomeImportParsedRow): string {
  return `${row.checkIn} → ${row.checkOut}`;
}

export const ImportIncomeCsvPreviewStep = memo(({ rows }: ImportIncomeCsvPreviewStepProps) => {
  const validRowCount = rows.filter((row) => !row.validationError).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {validRowCount} of {rows.length} stay row(s) are ready for review. Full editing arrives in
        the next phase.
      </p>

      <div className="rounded-lg border overflow-x-auto">
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Refunded</TableHead>
              <TableHead className="text-right">Room total</TableHead>
              <TableHead className="text-right">Net income</TableHead>
              <TableHead>Validation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.sourceFileName}-${row.rowIndex}`}>
                <TableCell className="max-w-[160px] truncate" title={row.guestName}>
                  {row.guestName}
                </TableCell>
                <TableCell>{row.roomNo ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatPreviewDateRange(row)}</TableCell>
                <TableCell>{formatStatusLabel(row.status)}</TableCell>
                <TableCell>
                  {row.refunded ? <Badge variant="secondary">Refunded</Badge> : "—"}
                </TableCell>
                <TableCell className="text-right">{formatMoney(row.roomTotal)}</TableCell>
                <TableCell className="text-right">
                  {row.netIncome != null ? formatMoney(row.netIncome) : "—"}
                </TableCell>
                <TableCell className="max-w-[220px]">
                  {row.validationError ? (
                    <span className="text-destructive inline-flex items-start gap-1 text-xs">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                      <span>{row.validationError}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Ready</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
ImportIncomeCsvPreviewStep.displayName = "ImportIncomeCsvPreviewStep";
