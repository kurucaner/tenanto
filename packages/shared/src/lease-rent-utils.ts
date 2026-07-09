import {
  calculateLeaseEndDate,
  enumerateLeaseMonths,
  transactionDateToMonth,
} from "./lease-date-utils";
import {
  type IExtendPropertyLongStayBody,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  PropertyLongStayStatus,
} from "./property-long-stay-types";

export const MAX_ADDITIONAL_TERM_MONTHS = 60;
export const MAX_TOTAL_LEASE_TERM_MONTHS = 120;

const MONTH_RE = /^\d{4}-\d{2}$/;

function addOneMonth(yyyyMm: string): string {
  const parts = yyyyMm.split("-").map(Number);
  let year = parts[0] ?? 0;
  let month = (parts[1] ?? 1) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getFirstExtensionMonth(leaseEndDate: string): string {
  return addOneMonth(transactionDateToMonth(leaseEndDate));
}

export function getLeaseRentForMonth(
  baseMonthlyRent: number,
  rentPeriods: IPropertyLongStayRentPeriod[],
  month: string
): number {
  if (rentPeriods.length === 0) {
    return baseMonthlyRent;
  }

  let applicableRent = baseMonthlyRent;
  for (const period of rentPeriods) {
    if (period.effectiveFromMonth <= month) {
      applicableRent = period.monthlyRent;
    } else {
      break;
    }
  }
  return applicableRent;
}

export function getCurrentLeaseRent(
  baseMonthlyRent: number,
  rentPeriods: IPropertyLongStayRentPeriod[],
  today: string
): number {
  return getLeaseRentForMonth(baseMonthlyRent, rentPeriods, transactionDateToMonth(today));
}

export function getExtensionRentEffectiveMonthOptions(
  leaseEndDate: string,
  leaseStartDate: string,
  currentTermMonths: number,
  additionalTermMonths: number
): string[] {
  const firstExtensionMonth = getFirstExtensionMonth(leaseEndDate);
  const newLeaseEndDate = calculateLeaseEndDate(
    leaseStartDate,
    currentTermMonths + additionalTermMonths
  );
  return enumerateLeaseMonths(`${firstExtensionMonth}-01`, newLeaseEndDate);
}

function validateLeaseRentChange(
  body: IExtendPropertyLongStayBody,
  lease: Pick<IPropertyLongStay, "leaseEndDate" | "leaseStartDate">,
  newTotalTerm: number
): string | null {
  const hasNewRent = body.newMonthlyRent !== undefined;
  const hasEffectiveMonth = body.rentEffectiveFromMonth !== undefined;

  if (hasNewRent !== hasEffectiveMonth) {
    return "New monthly rent and effective month must both be provided when changing rent";
  }
  if (!hasNewRent || body.newMonthlyRent === undefined || body.rentEffectiveFromMonth === undefined) {
    return null;
  }

  if (
    typeof body.newMonthlyRent !== "number" ||
    !Number.isFinite(body.newMonthlyRent) ||
    body.newMonthlyRent <= 0
  ) {
    return "New monthly rent must be a positive number";
  }

  if (!MONTH_RE.test(body.rentEffectiveFromMonth)) {
    return "Rent effective month must be YYYY-MM format";
  }

  const firstExtensionMonth = getFirstExtensionMonth(lease.leaseEndDate);
  const newLeaseEndDate = calculateLeaseEndDate(lease.leaseStartDate, newTotalTerm);
  const lastExtensionMonth = transactionDateToMonth(newLeaseEndDate);

  if (body.rentEffectiveFromMonth < firstExtensionMonth) {
    return "Rent effective month cannot be before the extension period";
  }
  if (body.rentEffectiveFromMonth > lastExtensionMonth) {
    return "Rent effective month cannot be after the new lease end";
  }

  return null;
}

export function validateExtendLease(
  body: IExtendPropertyLongStayBody,
  lease: Pick<IPropertyLongStay, "leaseEndDate" | "leaseStartDate" | "status" | "termMonths">,
  _today: string
): string | null {
  if (lease.status !== PropertyLongStayStatus.ACTIVE) {
    return "Only active leases can be extended";
  }

  const { additionalTermMonths } = body;
  if (
    !Number.isInteger(additionalTermMonths) ||
    additionalTermMonths < 1 ||
    additionalTermMonths > MAX_ADDITIONAL_TERM_MONTHS
  ) {
    return `Additional term must be between 1 and ${MAX_ADDITIONAL_TERM_MONTHS} months`;
  }

  const newTotalTerm = lease.termMonths + additionalTermMonths;
  if (newTotalTerm > MAX_TOTAL_LEASE_TERM_MONTHS) {
    return `Total lease term cannot exceed ${MAX_TOTAL_LEASE_TERM_MONTHS} months`;
  }

  return validateLeaseRentChange(body, lease, newTotalTerm);
}
