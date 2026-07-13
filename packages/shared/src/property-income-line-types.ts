import type { IPropertyIncomeLinesListMeta } from "./list-meta-types";
import type { TIncomeRefundFilter } from "./property-income-refund-filter-types";
import type { IPropertyReservation } from "./property-reservation-types";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";

// A null `unitId` on an income line means it is not tied to a specific rentable unit —
// i.e. property-level "Property Amenity" income (pool, parking, vending, etc.).
export const PROPERTY_AMENITY_UNIT_LABEL = "Property Amenity";

export interface IPropertyIncomeLine {
  amount: number;
  channelCommission: number;
  createdAt: string;
  deletedAt: string | null;
  description: string | null;
  grossIncome: number;
  guestName: string | null;
  id: string;
  incomeLineTypeId: string;
  incomeLineTypeName?: string;
  isDeleted: boolean;
  longStayId: string | null;
  netIncome: number;
  propertyId: string;
  refundedAmount: number | null;
  refundedAt: string | null;
  refundedBy: string | null;
  reservationId: string | null;
  taxBreakdown: IPropertyTaxBreakdownItem[];
  transactionDate: string;
  unitId: string | null;
  updatedAt: string;
}

export interface IPropertyIncomeLineComputedFields {
  channelCommission: number;
  grossIncome: number;
  netIncome: number;
  taxBreakdown: IPropertyTaxBreakdownItem[];
}

export interface ICreatePropertyIncomeLineBody {
  amount: number;
  description?: string;
  guestName?: string;
  incomeLineTypeId: string;
  longStayId?: string;
  reservationId?: string;
  transactionDate: string;
  unitId?: string | null;
}

export interface IUpdatePropertyIncomeLineBody {
  amount?: number;
  description?: string | null;
  guestName?: string | null;
  incomeLineTypeId?: string;
  longStayId?: string | null;
  reservationId?: string | null;
  transactionDate?: string;
  unitId?: string | null;
}

export interface IPropertyIncomeLinesListQuery {
  cursor?: string;
  from?: string;
  incomeLineTypeId?: string;
  limit?: number;
  longStayId?: string;
  q?: string;
  refundStatus?: TIncomeRefundFilter;
  rentalType?: import("./property-types").TUnitRentalType;
  reservationId?: string;
  to?: string;
  unitId?: string;
}

export type TPropertyIncomeLinesListFilters = Pick<
  IPropertyIncomeLinesListQuery,
  "from" | "incomeLineTypeId" | "q" | "refundStatus" | "to" | "unitId"
>;

export interface IPropertyIncomeLinesListResponse {
  incomeLines: IPropertyIncomeLine[];
  meta?: IPropertyIncomeLinesListMeta;
  nextCursor: string | null;
}

export type TPropertyIncomeEntry =
  | { entryKind: "line"; line: IPropertyIncomeLine }
  | { entryKind: "stay"; stay: IPropertyReservation };

export const IncomeEntryKind = {
  LINE: "line",
  STAY: "stay",
} as const;

export type TIncomeEntryKind = (typeof IncomeEntryKind)[keyof typeof IncomeEntryKind];
