import type { IPropertyTaxBreakdownItem } from "./property-settings-types";
import type { TUnitRentalType } from "./property-types";

export const ReservationStatus = {
  ACTIVE: "active",
  CANCELED: "canceled",
  NO_SHOW: "no_show",
  STAYED: "stayed",
} as const;

export type TReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const ReservationChannel = {
  AIRBNB: "airbnb",
  BOOKING: "booking",
  DIRECT: "direct",
  EXPEDIA: "expedia",
} as const;

export type TReservationChannel = (typeof ReservationChannel)[keyof typeof ReservationChannel];

export interface IPropertyReservation {
  channel: TReservationChannel;
  channelCommission: number;
  /** Decimal rate used when commission was calculated (e.g. 0.155). */
  channelCommissionRate: number;
  checkIn: string;
  checkOut: string;
  cleaningFee: number;
  createdAt: string;
  deletedAt: string | null;
  grossIncome: number;
  guestName: string;
  id: string;
  isDeleted: boolean;
  netIncome: number;
  nights: number;
  propertyId: string;
  reservationNumber: string | null;
  roomRate: number;
  status: TReservationStatus;
  taxBreakdown: IPropertyTaxBreakdownItem[];
  unitId: string;
  updatedAt: string;
}

export interface ICreatePropertyReservationBody {
  channel: TReservationChannel;
  checkIn: string;
  checkOut: string;
  cleaningFee: number;
  guestName: string;
  reservationNumber?: string;
  roomRate: number;
  status: TReservationStatus;
  unitId: string;
}

export interface IUpdatePropertyReservationBody {
  channel?: TReservationChannel;
  checkIn?: string;
  checkOut?: string;
  cleaningFee?: number;
  guestName?: string;
  reservationNumber?: string | null;
  roomRate?: number;
  status?: TReservationStatus;
  unitId?: string;
}

export interface IPropertyReservationsListQuery {
  channel?: TReservationChannel;
  checkInTo?: string;
  checkOutFrom?: string;
  from?: string;
  includeReservationId?: string;
  limit?: number;
  rentalType?: TUnitRentalType;
  status?: TReservationStatus;
  to?: string;
  unitId?: string;
}

export interface IPropertyReservationComputedFields {
  channelCommission: number;
  channelCommissionRate: number;
  grossIncome: number;
  netIncome: number;
  nights: number;
  taxBreakdown: IPropertyTaxBreakdownItem[];
}
