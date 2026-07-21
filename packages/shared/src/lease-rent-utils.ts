import { enumerateLeaseMonths, transactionDateToMonth } from "./lease-date-utils";
import { resolveLeaseWeekPeriodStartContainingDate } from "./lease-week-proration-utils";
import {
  deriveTermMonthsFromDates,
  parseLeaseIsoDate,
  resolveExtendLeaseEndDate,
} from "./lease-term-input-utils";
import {
  type IExtendPropertyLongStayBody,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  PropertyLongStayStatus,
} from "./property-long-stay-types";
import { isWeeklyRentBillingCadence } from "./rent-billing-cadence";

export const MAX_ADDITIONAL_TERM_MONTHS = 60;
export const MAX_ADDITIONAL_TERM_WEEKS = 260;
export const MAX_TOTAL_LEASE_TERM_MONTHS = 120;

const MONTH_RE = /^\d{4}-\d{2}$/;

function daysBetweenIsoDates(fromDate: string, toDate: string): number {
  const fromMs = Date.parse(`${fromDate}T00:00:00`);
  const toMs = Date.parse(`${toDate}T00:00:00`);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

function validateWeeklyExtensionSpan(
  currentLeaseEndDate: string,
  newLeaseEndDate: string
): string | null {
  const extensionDays = daysBetweenIsoDates(currentLeaseEndDate, newLeaseEndDate);
  if (extensionDays <= 0) {
    return "New lease end date must be after the current contract end date";
  }

  if (extensionDays % 7 !== 0) {
    return "Weekly lease extensions must add whole weeks";
  }

  return null;
}

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

export function getLeaseRentForPeriod(
  baseMonthlyRent: number,
  rentPeriods: readonly IPropertyLongStayRentPeriod[],
  periodKey: string
): number {
  if (rentPeriods.length === 0) {
    return baseMonthlyRent;
  }

  let applicableRent = baseMonthlyRent;
  for (const period of rentPeriods) {
    if (period.effectiveFromMonth <= periodKey) {
      applicableRent = period.monthlyRent;
    } else {
      break;
    }
  }
  return applicableRent;
}

/** @deprecated Prefer `getLeaseRentForPeriod` — period key is `YYYY-MM` or `YYYY-MM-DD`. */
export function getLeaseRentForMonth(
  baseMonthlyRent: number,
  rentPeriods: readonly IPropertyLongStayRentPeriod[],
  month: string
): number {
  return getLeaseRentForPeriod(baseMonthlyRent, rentPeriods, month);
}

export function getCurrentLeaseRent(
  baseMonthlyRent: number,
  rentPeriods: readonly IPropertyLongStayRentPeriod[],
  today: string,
  lease?: Pick<IPropertyLongStay, "leaseStartDate" | "rentBillingCadence">
): number {
  const periodKey =
    lease && isWeeklyRentBillingCadence(lease.rentBillingCadence)
      ? resolveLeaseWeekPeriodStartContainingDate(lease.leaseStartDate, today)
      : transactionDateToMonth(today);

  return getLeaseRentForPeriod(baseMonthlyRent, rentPeriods, periodKey);
}

export function getExtensionRentEffectiveMonthOptions(
  currentLeaseEndDate: string,
  newLeaseEndDate: string
): string[] {
  const firstExtensionMonth = getFirstExtensionMonth(currentLeaseEndDate);
  return enumerateLeaseMonths(`${firstExtensionMonth}-01`, newLeaseEndDate);
}

function validateLeaseRentChange(
  body: IExtendPropertyLongStayBody,
  lease: Pick<IPropertyLongStay, "leaseEndDate" | "leaseStartDate" | "rentBillingCadence">,
  newLeaseEndDate: string
): string | null {
  const hasNewRent = body.newMonthlyRent !== undefined;
  const hasEffectiveMonth = body.rentEffectiveFromMonth !== undefined;

  if (hasNewRent !== hasEffectiveMonth) {
    return "New monthly rent and effective month must both be provided when changing rent";
  }
  if (
    !hasNewRent ||
    body.newMonthlyRent === undefined ||
    body.rentEffectiveFromMonth === undefined
  ) {
    return null;
  }

  if (isWeeklyRentBillingCadence(lease.rentBillingCadence)) {
    return "Rent amount cannot be changed when extending a weekly-billed lease";
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
  lease: Pick<
    IPropertyLongStay,
    "leaseEndDate" | "leaseStartDate" | "rentBillingCadence" | "status" | "termMonths"
  >,
  _today: string
): string | null {
  if (lease.status !== PropertyLongStayStatus.ACTIVE) {
    return "Only active leases can be extended";
  }

  const isWeekly = isWeeklyRentBillingCadence(lease.rentBillingCadence);
  const hasCustomEnd = body.newLeaseEndDate !== undefined && body.newLeaseEndDate !== "";
  const hasAdditionalMonths = body.additionalTermMonths !== undefined;
  const hasAdditionalWeeks = body.additionalWeeks !== undefined;
  const extensionModeCount = [hasCustomEnd, hasAdditionalMonths, hasAdditionalWeeks].filter(
    Boolean
  ).length;

  if (extensionModeCount !== 1) {
    return isWeekly
      ? "Provide additionalWeeks or newLeaseEndDate, but not both"
      : "Provide additionalTermMonths or newLeaseEndDate, but not both";
  }

  if (isWeekly && hasAdditionalMonths) {
    return "Weekly leases must be extended by additionalWeeks or newLeaseEndDate";
  }

  if (!isWeekly && hasAdditionalWeeks) {
    return "Monthly leases must be extended by additionalTermMonths or newLeaseEndDate";
  }

  if (hasCustomEnd) {
    const newLeaseEndDate = parseLeaseIsoDate(body.newLeaseEndDate ?? "");
    if (!newLeaseEndDate) {
      return "newLeaseEndDate must be a YYYY-MM-DD date";
    }

    const endDateError = isWeekly
      ? validateWeeklyExtensionSpan(lease.leaseEndDate, newLeaseEndDate)
      : newLeaseEndDate <= lease.leaseEndDate
        ? "New lease end date must be after the current contract end date"
        : null;
    if (endDateError) {
      return endDateError;
    }

    const newTermMonths = deriveTermMonthsFromDates(lease.leaseStartDate, newLeaseEndDate);
    if (newTermMonths > MAX_TOTAL_LEASE_TERM_MONTHS) {
      return `Total lease term cannot exceed ${MAX_TOTAL_LEASE_TERM_MONTHS} months`;
    }

    return validateLeaseRentChange(body, lease, newLeaseEndDate);
  }

  if (hasAdditionalWeeks) {
    const { additionalWeeks } = body;
    if (
      !Number.isInteger(additionalWeeks) ||
      additionalWeeks! < 1 ||
      additionalWeeks! > MAX_ADDITIONAL_TERM_WEEKS
    ) {
      return `Additional term must be between 1 and ${MAX_ADDITIONAL_TERM_WEEKS} weeks`;
    }

    let newLeaseEndDate: string;
    try {
      newLeaseEndDate = resolveExtendLeaseEndDate(lease, body).newLeaseEndDate;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid extend lease input";
    }

    const newTermMonths = deriveTermMonthsFromDates(lease.leaseStartDate, newLeaseEndDate);
    if (newTermMonths > MAX_TOTAL_LEASE_TERM_MONTHS) {
      return `Total lease term cannot exceed ${MAX_TOTAL_LEASE_TERM_MONTHS} months`;
    }

    return validateLeaseRentChange(body, lease, newLeaseEndDate);
  }

  const { additionalTermMonths } = body;
  if (
    !Number.isInteger(additionalTermMonths) ||
    additionalTermMonths! < 1 ||
    additionalTermMonths! > MAX_ADDITIONAL_TERM_MONTHS
  ) {
    return `Additional term must be between 1 and ${MAX_ADDITIONAL_TERM_MONTHS} months`;
  }

  const newTotalTerm = lease.termMonths + additionalTermMonths!;
  if (newTotalTerm > MAX_TOTAL_LEASE_TERM_MONTHS) {
    return `Total lease term cannot exceed ${MAX_TOTAL_LEASE_TERM_MONTHS} months`;
  }

  let newLeaseEndDate: string;
  try {
    newLeaseEndDate = resolveExtendLeaseEndDate(lease, body).newLeaseEndDate;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid extend lease input";
  }

  return validateLeaseRentChange(body, lease, newLeaseEndDate);
}
