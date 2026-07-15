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
  from?: string;
  limit?: number;
  q?: string;
  status?: TPropertyLongStayStatus;
  to?: string;
  unitId?: string;
}

export type TPropertyLongStaysListFilters = Pick<
  IPropertyLongStaysListQuery,
  "from" | "q" | "status" | "to" | "unitId"
>;

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
  daysInMonth: number;
  expectedRent: number;
  incomeLineId?: string;
  isPaid: boolean;
  isProrated: boolean;
  month: string;
  occupiedDays: number;
}
