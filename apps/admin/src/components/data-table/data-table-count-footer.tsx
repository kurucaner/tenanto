import { memo } from "react";

import { TableCell, TableRow } from "@/components/ui/table";

export interface DataTableCountFooterItem {
  label: string;
  value: string;
}

interface DataTableCountFooterProps {
  colSpan: number;
  items: DataTableCountFooterItem[];
}

export const DataTableCountFooter = memo(({ colSpan, items }: DataTableCountFooterProps) => (
  <TableRow>
    <TableCell className="text-muted-foreground text-xs" colSpan={colSpan}>
      <div className="flex items-center gap-4">
        {items.map((item) => (
          <span key={item.label}>
            {item.label}: <span className="text-foreground font-medium">{item.value}</span>
          </span>
        ))}
      </div>
    </TableCell>
  </TableRow>
));
DataTableCountFooter.displayName = "DataTableCountFooter";
