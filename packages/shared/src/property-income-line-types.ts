import type { IPropertyReservation } from "./property-reservation-types";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";
import type { TUnitRentalType } from "./property-types";

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
  createdAt: string;
  description: string | null;
  grossIncome: number;
  guestName: string | null;
  id: string;
  lineType: TIncomeLineType;
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
  rentalType?: TUnitRentalType;
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
