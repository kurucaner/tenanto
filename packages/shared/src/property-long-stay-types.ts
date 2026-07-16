import type { ILeasePrimaryTenantContact } from "./lease-primary-tenant-contact";
import type { IPropertyLongStaysListMeta } from "./list-meta-types";
import type {
  TPropertyLongStaysListSortBy,
  TPropertyLongStaysListSortDir,
} from "./property-long-stay-list-constants";
import type { ICreateLeasePortalInviteResult } from "./tenant-portal-types";

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
  /** Legacy storage; prefer `primaryTenantContact` when present (Phase 1+). */
  guestName: string;
  id: string;
  leaseEndDate: string;
  leaseStartDate: string;
  monthlyRent: number;
  propertyId: string;
  secondaryTenants: IPropertyLongStaySecondaryTenant[];
  status: TPropertyLongStayStatus;
  /** Legacy storage; prefer `primaryTenantContact` when present (Phase 1+). */
  tenantEmail: string | null;
  /** Legacy storage; prefer `primaryTenantContact` when present (Phase 1+). */
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

export interface ICreatePropertyLongStayResponse {
  longStay: IPropertyLongStay;
  /** Present when a valid primary email triggered auto-invite; absent when skipped. */
  portalInvite?: ICreateLeasePortalInviteResult;
}

export interface IPropertyLongStaysListQuery {
  cursor?: string;
  from?: string;
  limit?: number;
  q?: string;
  sortBy?: TPropertyLongStaysListSortBy;
  sortDir?: TPropertyLongStaysListSortDir;
  status?: TPropertyLongStayStatus;
  to?: string;
  unitId?: string;
}

export type TPropertyLongStaysListFilters = Pick<
  IPropertyLongStaysListQuery,
  "from" | "q" | "sortBy" | "sortDir" | "status" | "to" | "unitId"
>;

export interface IPropertyLongStaysListResponse {
  longStays: IPropertyLongStay[];
  meta?: IPropertyLongStaysListMeta;
  nextCursor: string | null;
}

export interface IPropertyLongStayDetailResponse {
  longStay: IPropertyLongStay;
  /** Effective primary tenant contact (linked user, pending invite, or lease fallback). */
  primaryTenantContact: ILeasePrimaryTenantContact;
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
  /** First non-deleted income line with reportable rent for the period (display/link only). */
  incomeLineId?: string;
  isPaid: boolean;
  isProrated: boolean;
  month: string;
  occupiedDays: number;
  paidRent: number;
  remainingRent: number;
}
