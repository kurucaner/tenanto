import type { ILeasePrimaryTenantContact } from "./lease-primary-tenant-contact";
import type { ILeaseSecondaryTenantContact } from "./lease-secondary-tenant-contact";
import type { IPropertyLongStaysListMeta } from "./list-meta-types";
import type {
  TPropertyLongStaysListSortBy,
  TPropertyLongStaysListSortDir,
} from "./property-long-stay-list-constants";
import type { TRentBillingCadence } from "./rent-billing-cadence";
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
  /**
   * @deprecated Use `rentAmount`. Shimmed on API responses for one release after Phase 14.
   */
  monthlyRent?: number;
  propertyId: string;
  rentAmount: number;
  rentBillingCadence: TRentBillingCadence;
  /** Populated on list/export reads from non-terminal secondary memberships. */
  secondaryOccupantNames?: string[];
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
  leaseEndDate?: string;
  leaseStartDate: string;
  /** @deprecated Use `rentAmount`. Accepted on create for one release after Phase 14. */
  monthlyRent?: number;
  rentAmount: number;
  rentBillingCadence?: TRentBillingCadence;
  tenantEmail?: string;
  tenantPhone?: string;
  termMonths?: number;
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
  /** Effective secondary occupant contacts from membership rows (+ legacy JSONB merge when present). */
  secondaryTenantContacts?: ILeaseSecondaryTenantContact[];
  termsEditability: ILeaseTermsEditability;
}

/** A rent amount effective from a schedule period key onward. */
export interface IPropertyLongStayRentPeriod {
  /**
   * @deprecated Use `effectiveFromPeriod`. Shimmed on API responses for one release after Phase 14.
   */
  effectiveFromMonth?: string;
  /** Period key: `YYYY-MM` (monthly cadence) or `YYYY-MM-DD` week start (weekly cadence). */
  effectiveFromPeriod: string;
  /**
   * @deprecated Use `rentAmount`. Shimmed on API responses for one release after Phase 14.
   */
  monthlyRent?: number;
  /** Recurring rent amount for the lease's billing cadence. */
  rentAmount: number;
}

export interface IExtendPropertyLongStayBody {
  additionalTermMonths?: number;
  additionalWeeks?: number;
  newLeaseEndDate?: string;
  /** @deprecated Use `newRentAmount`. Accepted on extend for one release after Phase 14. */
  newMonthlyRent?: number;
  newRentAmount?: number;
  /** @deprecated Use `rentEffectiveFromPeriod`. Accepted on extend for one release after Phase 14. */
  rentEffectiveFromMonth?: string;
  rentEffectiveFromPeriod?: string;
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

export const LeaseTermsEditBlockReason = {
  HAS_INCOME_LINES: "has_income_lines",
  HAS_RENT_PERIOD_HISTORY: "has_rent_period_history",
  HAS_SUCCEEDED_PAYMENTS: "has_succeeded_payments",
  LEASE_ENDED: "lease_ended",
  WEEKLY_CADENCE: "weekly_cadence",
} as const;

export type TLeaseTermsEditBlockReason =
  (typeof LeaseTermsEditBlockReason)[keyof typeof LeaseTermsEditBlockReason];

export interface ILeaseTermsEditability {
  editable: boolean;
  reason?: TLeaseTermsEditBlockReason;
}

export interface ILeaseTermsEditSignals {
  hasIncomeLines: boolean;
  hasRentPeriodHistory: boolean;
  hasSucceededPayments: boolean;
}

export interface IEditPropertyLongStayTermsBody {
  leaseEndDate?: string;
  leaseStartDate: string;
  /** @deprecated Use `rentAmount`. Accepted on edit terms for one release after Phase 14. */
  monthlyRent?: number;
  rentAmount: number;
  termMonths?: number;
}

export interface IEditPropertyLongStayTermsResponse {
  longStay: IPropertyLongStay;
}

export interface IPropertyLongStayRentMonth {
  daysInMonth: number;
  expectedRent: number;
  /** First non-deleted income line with reportable rent for the period (display/link only). */
  incomeLineId?: string;
  isPaid: boolean;
  isProrated: boolean;
  /** @deprecated Use `periodKey`. Shimmed on API responses for one release after Phase 14. */
  month?: string;
  occupiedDays: number;
  paidRent: number;
  /** Schedule period key (`YYYY-MM` or week-start `YYYY-MM-DD`). */
  periodKey: string;
  remainingRent: number;
}
