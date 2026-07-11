import { type TAriaSort, type TSortDirection } from "@/lib/table-sort";

export interface DataTableColumn {
  align?: "left" | "right";
  /** Permission-gated columns (e.g. Actions when the user cannot manage). */
  hidden?: boolean;
  id: string;
  /** Header tooltip text (rendered by SortableTableHead). */
  info?: string;
  label: string;
  /** Requires the DataTable `sort` prop to take effect. */
  sortable?: boolean;
}

/** Shape of useUrlTableSort's return, the standard sort controller. */
export interface DataTableSortController {
  getColumnAriaSort: (columnId: string) => TAriaSort;
  getColumnDirection: (columnId: string) => TSortDirection | null;
  toggleSort: (columnId: string) => void;
}
