import { memo, type ReactNode } from "react";

import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TSortDirection } from "@/lib/table-sort";

export interface ReportTableColumnDef {
  align?: "left" | "right";
  id: string;
  label: string;
  sortable?: boolean;
}

interface ReportSectionTableProps {
  children: ReactNode;
  columns: ReportTableColumnDef[];
  emptyMessage?: string;
  getColumnAriaSort: (columnId: string) => "ascending" | "descending" | "none";
  getColumnDirection: (columnId: string) => TSortDirection | null;
  isEmpty?: boolean;
  onSortColumn: (columnId: string) => void;
  title: string;
}

export const ReportSectionTable = memo(
  ({
    children,
    columns,
    emptyMessage,
    getColumnAriaSort,
    getColumnDirection,
    isEmpty = false,
    onSortColumn,
    title,
  }: ReportSectionTableProps) => (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <SortableTableHead
                  align={column.align}
                  ariaSort={getColumnAriaSort(column.id)}
                  direction={getColumnDirection(column.id)}
                  key={column.id}
                  label={column.label}
                  onSort={() => onSortColumn(column.id)}
                  sortable={column.sortable ?? true}
                />
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
