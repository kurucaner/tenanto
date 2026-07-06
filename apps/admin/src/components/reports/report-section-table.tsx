import { memo, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReportSectionTableProps {
  children: ReactNode;
  columns: string[];
  emptyMessage?: string;
  isEmpty?: boolean;
  title: string;
}

export const ReportSectionTable = memo(
  ({ children, columns, emptyMessage, isEmpty = false, title }: ReportSectionTableProps) => (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={columns.length}>
                  {emptyMessage ?? "No data for this period."}
                </TableCell>
              </TableRow>
            ) : (
              children
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
);
ReportSectionTable.displayName = "ReportSectionTable";
