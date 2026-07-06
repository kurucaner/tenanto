import type { IPropertyReservation } from "./property-reservation-types";

export const IncomeLineType = {
  BEACH_EQUIPMENT_RENTAL: "beach_equipment_rental",
  CLEANING_ONLY: "cleaning_only",
  EXTRA_CLEANING: "extra_cleaning",
  EXTRA_SERVICE: "extra_service",
} as const;

export type TIncomeLineType = (typeof IncomeLineType)[keyof typeof IncomeLineType];

export interface IPropertyIncomeLine {
  amount: number;
  channelCommission: number;
  conventionDevelopmentTax: number;
  createdAt: string;
  description: string | null;
  grossIncome: number;
  guestName: string | null;
  id: string;
  lineType: TIncomeLineType;
  miamiDadeSurtax: number;
  netIncome: number;
  propertyId: string;
  reservationId: string | null;
  resortTax: number;
  salesTax: number;
  transactionDate: string;
  unitId: string;
  updatedAt: string;
}

export interface IPropertyIncomeLineComputedFields {
  channelCommission: number;
  conventionDevelopmentTax: number;
  grossIncome: number;
  miamiDadeSurtax: number;
  netIncome: number;
  resortTax: number;
  salesTax: number;
}

export interface ICreatePropertyIncomeLineBody {
  amount: number;
  description?: string;
  guestName?: string;
  lineType: TIncomeLineType;
  reservationId?: string;
  transactionDate: string;
  unitId: string;
}

export interface IUpdatePropertyIncomeLineBody {
  amount?: number;
  description?: string | null;
  guestName?: string | null;
  lineType?: TIncomeLineType;
  reservationId?: string | null;
  transactionDate?: string;
  unitId?: string;
}

export interface IPropertyIncomeLinesListQuery {
  from?: string;
  lineType?: TIncomeLineType;
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
