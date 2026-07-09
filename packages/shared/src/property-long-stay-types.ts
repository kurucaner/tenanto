export type TPropertyLongStayStatus = "active" | "ended";

export const PropertyLongStayStatus = {
  ACTIVE: "active",
  ENDED: "ended",
} as const;

export interface IPropertyLongStay {
  actualEndDate: string | null;
  createdAt: string;
  guestName: string;
  id: string;
  leaseEndDate: string;
  leaseStartDate: string;
  monthlyRent: number;
  propertyId: string;
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
  status?: TPropertyLongStayStatus;
  unitId?: string;
}

export interface IPropertyLongStaysListResponse {
  longStays: IPropertyLongStay[];
}

export interface IPropertyLongStayDetailResponse {
  longStay: IPropertyLongStay;
  rentSchedule: IPropertyLongStayRentMonth[];
}

export interface IEndPropertyLongStayBody {
  actualEndDate: string;
}

export interface IPropertyLongStayRentMonth {
  incomeLineId?: string;
  isPaid: boolean;
  month: string;
}
