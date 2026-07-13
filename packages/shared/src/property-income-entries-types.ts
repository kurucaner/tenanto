import type { IPropertyIncomeEntriesListMeta } from "./list-meta-types";
import type { TPropertyIncomeEntry } from "./property-income-line-types";
import type { TIncomeRefundFilter } from "./property-income-refund-filter-types";
import type { TReservationStatus } from "./property-reservation-types";

export type TPropertyIncomeEntriesListSortBy =
  | "channel"
  | "checkOut"
  | "cleaning"
  | "commission"
  | "date"
  | "gross"
  | "guest"
  | "net"
  | "netPayout"
  | "nights"
  | "roomTotal"
  | "status"
  | "taxes"
  | "type"
  | "unit";

export type TPropertyIncomeEntriesListSortDir = "asc" | "desc";

export interface IPropertyIncomeEntriesListQuery {
  channelCommissionId?: string;
  cursor?: string;
  from?: string;
  /** Empty = all entries; `stay` = stays only; otherwise an income line type id. */
  incomeType?: string;
  limit?: number;
  q?: string;
  refundStatus?: TIncomeRefundFilter;
  sortBy?: TPropertyIncomeEntriesListSortBy;
  sortDir?: TPropertyIncomeEntriesListSortDir;
  status?: TReservationStatus;
  to?: string;
  unitId?: string;
}

export type TPropertyIncomeEntriesListFilters = Pick<
  IPropertyIncomeEntriesListQuery,
  | "channelCommissionId"
  | "from"
  | "incomeType"
  | "q"
  | "refundStatus"
  | "sortBy"
  | "sortDir"
  | "status"
  | "to"
  | "unitId"
>;

export interface IPropertyIncomeEntriesListResponse {
  entries: TPropertyIncomeEntry[];
  meta?: IPropertyIncomeEntriesListMeta;
  nextCursor: string | null;
}
