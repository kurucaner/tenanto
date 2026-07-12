import type { IPropertyLongStaysListMeta } from "./list-meta-types";

export type TPropertyLongStayStatus = "active" | "ended";

export const PropertyLongStayStatus = {
  ACTIVE: "active",
  ENDED: "ended",
} as const;

export interface IPropertyLongStaySecondaryTenant {
  email: string | null;
  name: string;
  phone: string | null;
}

export interface IPropertyLongStay {
  actualEndDate: string | null;
  createdAt: string;
  guestName: string;
  id: string;
  leaseEndDate: string;
  leaseStartDate: string;
  monthlyRent: number;
  propertyId: string;
  secondaryTenants: IPropertyLongStaySecondaryTenant[];
  status: TPropertyLongStayStatus;
  tenantEmail: string | null;
  tenantPhone: string | null;
  termMonths: number;
  unitId: string;
  updatedAt: string;
}

export interface ICreatePropertyLongStayBody {
  guestName: string;
  leaseStartDate: string;
  monthlyRent: number;
  tenantEmail?: string;
  tenantPhone?: string;
  termMonths: number;
  unitId: string;
}

export interface IPropertyLongStaysListQuery {
  cursor?: string;
  limit?: number;
  status?: TPropertyLongStayStatus;
  unitId?: string;
}

export interface IPropertyLongStaysListResponse {
  longStays: IPropertyLongStay[];
  meta?: IPropertyLongStaysListMeta;
  nextCursor: string | null;
}

export interface IPropertyLongStayDetailResponse {
  longStay: IPropertyLongStay;
  rentPeriods: IPropertyLongStayRentPeriod[];
  rentSchedule: IPropertyLongStayRentMonth[];
}

export interface IPropertyLongStayRentPeriod {
  effectiveFromMonth: string;
  monthlyRent: number;
}

export interface IExtendPropertyLongStayBody {
  additionalTermMonths: number;
  newMonthlyRent?: number;
  rentEffectiveFromMonth?: string;
}

export interface IEndPropertyLongStayBody {
  actualEndDate: string;
}

export interface IUpdatePropertyLongStayBody {
  guestName?: string;
  secondaryTenants?: IPropertyLongStaySecondaryTenant[];
  tenantEmail?: string | null;
  tenantPhone?: string | null;
}

export interface IPropertyLongStayRentMonth {
  expectedRent: number;
  incomeLineId?: string;
  isPaid: boolean;
  month: string;
}
