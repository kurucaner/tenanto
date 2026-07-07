import type { IPropertyReservation } from "./property-reservation-types";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";

export interface IPropertyIncomeLine {
  amount: number;
  channelCommission: number;
  createdAt: string;
  description: string | null;
  grossIncome: number;
  guestName: string | null;
  id: string;
  incomeLineTypeId: string;
  incomeLineTypeName?: string;
  netIncome: number;
  propertyId: string;
  reservationId: string | null;
  taxBreakdown: IPropertyTaxBreakdownItem[];
  transactionDate: string;
  unitId: string;
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
  reservationId?: string;
  transactionDate: string;
  unitId: string;
}

export interface IUpdatePropertyIncomeLineBody {
  amount?: number;
  description?: string | null;
  guestName?: string | null;
  incomeLineTypeId?: string;
  reservationId?: string | null;
  transactionDate?: string;
  unitId?: string;
}

export interface IPropertyIncomeLinesListQuery {
  from?: string;
  incomeLineTypeId?: string;
  rentalType?: import("./property-types").TUnitRentalType;
  reservationId?: string;
  to?: string;
  unitId?: string;
}

export type TPropertyIncomeEntry =
  | { entryKind: "line"; line: IPropertyIncomeLine }
  | { entryKind: "stay"; stay: IPropertyReservation };

export const IncomeEntryKind = {
  LINE: "line",
  STAY: "stay",
} as const;

export type TIncomeEntryKind = (typeof IncomeEntryKind)[keyof typeof IncomeEntryKind];
