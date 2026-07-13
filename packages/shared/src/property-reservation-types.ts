import type { IPropertyShortStaysListMeta } from "./list-meta-types";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";
import type { TUnitRentalType } from "./property-types";

export const ReservationStatus = {
  ACTIVE: "active",
  CANCELED: "canceled",
  NO_SHOW: "no_show",
  STAYED: "stayed",
} as const;

export type TReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export interface IPropertyReservation {
  channelCommission: number;
  channelCommissionId: string;
  /** Decimal rate used when commission was calculated (e.g. 0.155). */
  channelCommissionRate: number;
  channelName: string;
  checkIn: string;
  checkOut: string;
  cleaningFee: number;
  createdAt: string;
  deletedAt: string | null;
  excludeCleaningFromCommissionBase: boolean;
  excludeResortTaxFromPayout: boolean;
  grossIncome: number;
  guestName: string;
  id: string;
  isDeleted: boolean;
  netIncome: number;
  nights: number;
  propertyId: string;
  refundedAt: string | null;
  refundedBy: string | null;
  reservationNumber: string | null;
  roomTotal: number;
  status: TReservationStatus;
  taxBreakdown: IPropertyTaxBreakdownItem[];
  unitId: string;
  updatedAt: string;
}

export interface ICreatePropertyReservationBody {
  channelCommissionId: string;
  checkIn: string;
  checkOut: string;
  cleaningFee: number;
  guestName: string;
  reservationNumber?: string;
  roomTotal: number;
  status: TReservationStatus;
  unitId: string;
}

export interface IUpdatePropertyReservationBody {
  channelCommissionId?: string;
  checkIn?: string;
  checkOut?: string;
  cleaningFee?: number;
  guestName?: string;
  reservationNumber?: string | null;
  roomTotal?: number;
  status?: TReservationStatus;
  unitId?: string;
}

export interface IPropertyReservationsListQuery {
  channelCommissionId?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  cursor?: string;
  from?: string;
  includeReservationId?: string;
  limit?: number;
  q?: string;
  rentalType?: TUnitRentalType;
  status?: TReservationStatus;
  to?: string;
  unitId?: string;
}

export type TPropertyShortStaysListFilters = Pick<
  IPropertyReservationsListQuery,
  "channelCommissionId" | "from" | "q" | "status" | "to" | "unitId"
>;

export interface IPropertyShortStaysListResponse {
  meta?: IPropertyShortStaysListMeta;
  nextCursor: string | null;
  shortStays: IPropertyReservation[];
}

export interface IPropertyReservationComputedFields {
  channelCommission: number;
  channelCommissionRate: number;
  grossIncome: number;
  netIncome: number;
  nights: number;
  taxBreakdown: IPropertyTaxBreakdownItem[];
}
