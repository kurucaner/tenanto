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
  checkIn: string;
  checkOut: string;
  cleaningFee: number;
  conventionDevelopmentTax: number;
  createdAt: string;
  grossIncome: number;
  guestName: string;
  id: string;
  miamiDadeSurtax: number;
  netIncome: number;
  nights: number;
  propertyId: string;
  reservationNumber: string | null;
  resortTax: number;
  roomRate: number;
  salesTax: number;
  status: TReservationStatus;
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
  from?: string;
  rentalType?: TUnitRentalType;
  status?: TReservationStatus;
  to?: string;
  unitId?: string;
}

export interface IPropertyReservationComputedFields {
  channelCommission: number;
  conventionDevelopmentTax: number;
  grossIncome: number;
  miamiDadeSurtax: number;
  netIncome: number;
  nights: number;
  resortTax: number;
  salesTax: number;
}
