import {
  addDaysToIsoDate,
  enumerateLeaseMonths,
  enumerateLeaseWeeks,
  transactionDateToMonth,
} from "./lease-date-utils";
import {
  deriveTermMonthsFromDates,
  parseLeaseIsoDate,
  resolveExtendLeaseEndDate,
} from "./lease-term-input-utils";
import { resolveLeaseWeekPeriodStartContainingDate } from "./lease-week-proration-utils";
import {
  type IExtendPropertyLongStayBody,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  PropertyLongStayStatus,
} from "./property-long-stay-types";
import { isWeeklyRentBillingCadence } from "./rent-billing-cadence";
import {
  getLeaseRentAmount,
  getRentPeriodAmount,
  getRentPeriodEffectiveFrom,
  resolveExtendNewRentAmount,
  resolveExtendRentEffectivePeriod,
} from "./rent-period-field-utils";
import { isWeeklyPeriodKey } from "./rent-period-key-utils";

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

/** First week-start period key in the extension window (day after the week containing contract end). */
export function getFirstExtensionWeek(leaseStartDate: string, leaseEndDate: string): string {
  const containingWeekStart = resolveLeaseWeekPeriodStartContainingDate(
    leaseStartDate,
    leaseEndDate
  );
  return addDaysToIsoDate(containingWeekStart, 7);
}

export function getExtensionRentEffectiveWeekOptions(
  leaseStartDate: string,
  currentLeaseEndDate: string,
  newLeaseEndDate: string
): string[] {
  const firstExtensionWeek = getFirstExtensionWeek(leaseStartDate, currentLeaseEndDate);
  return enumerateLeaseWeeks(leaseStartDate, newLeaseEndDate).filter(
    (weekStart) => weekStart >= firstExtensionWeek
  );
}

export function getLeaseRentForPeriod(
  baseRentAmount: number,
  rentPeriods: readonly IPropertyLongStayRentPeriod[],
  periodKey: string
): number {
  if (rentPeriods.length === 0) {
    return baseRentAmount;
  }

  let applicableRent = baseRentAmount;
  for (const period of rentPeriods) {
    if (getRentPeriodEffectiveFrom(period) <= periodKey) {
      applicableRent = getRentPeriodAmount(period);
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

function validateMonthlyLeaseRentChange(
  newRentAmount: number,
  effectivePeriod: string,
  lease: Pick<IPropertyLongStay, "leaseEndDate">,
  newLeaseEndDate: string
): string | null {
  if (!Number.isFinite(newRentAmount) || newRentAmount <= 0) {
    return "New monthly rent must be a positive number";
  }

  if (!MONTH_RE.test(effectivePeriod)) {
    return "Rent effective month must be YYYY-MM format";
  }

  const firstExtensionMonth = getFirstExtensionMonth(lease.leaseEndDate);
  const lastExtensionMonth = transactionDateToMonth(newLeaseEndDate);

  if (effectivePeriod < firstExtensionMonth) {
    return "Rent effective month cannot be before the extension period";
  }
  if (effectivePeriod > lastExtensionMonth) {
    return "Rent effective month cannot be after the new lease end";
  }

  return null;
}

function validateWeeklyLeaseRentChange(
  newRentAmount: number,
  effectivePeriod: string,
  lease: Pick<IPropertyLongStay, "leaseEndDate" | "leaseStartDate">,
  newLeaseEndDate: string
): string | null {
  if (!Number.isFinite(newRentAmount) || newRentAmount <= 0) {
    return "New weekly rent must be a positive number";
  }

  if (!isWeeklyPeriodKey(effectivePeriod)) {
    return "Rent effective period must be YYYY-MM-DD format";
  }

  const allowedWeeks = getExtensionRentEffectiveWeekOptions(
    lease.leaseStartDate,
    lease.leaseEndDate,
    newLeaseEndDate
  );

  if (!allowedWeeks.includes(effectivePeriod)) {
    return "Rent effective period must be a week start within the extension window";
  }

  return null;
}

function validateLeaseRentChange(
  body: IExtendPropertyLongStayBody,
  lease: Pick<IPropertyLongStay, "leaseEndDate" | "leaseStartDate" | "rentBillingCadence">,
  newLeaseEndDate: string
): string | null {
  const newRentAmount = resolveExtendNewRentAmount(body);
  const effectivePeriod = resolveExtendRentEffectivePeriod(body);
  const hasNewRent = newRentAmount !== undefined;
  const hasEffectivePeriod = effectivePeriod !== undefined;

  if (hasNewRent !== hasEffectivePeriod) {
    return "New rent amount and effective period must both be provided when changing rent";
  }
  if (newRentAmount === undefined || effectivePeriod === undefined) {
    return null;
  }

  if (isWeeklyRentBillingCadence(lease.rentBillingCadence)) {
    return validateWeeklyLeaseRentChange(newRentAmount, effectivePeriod, lease, newLeaseEndDate);
  }

  return validateMonthlyLeaseRentChange(newRentAmount, effectivePeriod, lease, newLeaseEndDate);
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
