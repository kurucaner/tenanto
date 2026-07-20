import { addDaysToIsoDate, calculateLeaseEndDate, enumerateLeaseMonths } from "./lease-date-utils";
import { MAX_LEASE_TERM_MONTHS } from "./lease-terms-edit-utils";
import {
  type IExtendPropertyLongStayBody,
  type IPropertyLongStay,
} from "./property-long-stay-types";

export type LeaseTermInputMode = "customEnd" | "months";

export type LeaseExtendInputMode = "customEnd" | "months";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export { addMonthsToIsoDate } from "./lease-date-utils";

export function parseLeaseIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) {
    return null;
  }

  const date = Date.parse(`${trimmed}T00:00:00Z`);
  if (!Number.isFinite(date)) {
    return null;
  }

  return trimmed;
}

export function deriveTermMonthsFromDates(leaseStartDate: string, leaseEndDate: string): number {
  return enumerateLeaseMonths(leaseStartDate, leaseEndDate).length;
}

export type IResolveLeaseEndDateInput = {
  leaseEndDate?: string;
  leaseStartDate: string;
  termMonths?: number;
};

export type IResolvedLeaseTerm = {
  leaseEndDate: string;
  termMonths: number;
};

export function resolveLeaseEndDate(input: IResolveLeaseEndDateInput): IResolvedLeaseTerm {
  const leaseStartDate = parseLeaseIsoDate(input.leaseStartDate);
  if (!leaseStartDate) {
    throw new Error("leaseStartDate must be a YYYY-MM-DD date");
  }

  if (input.leaseEndDate !== undefined) {
    const leaseEndDate = parseLeaseIsoDate(input.leaseEndDate);
    if (!leaseEndDate) {
      throw new Error("leaseEndDate must be a YYYY-MM-DD date");
    }

    return {
      leaseEndDate,
      termMonths: deriveTermMonthsFromDates(leaseStartDate, leaseEndDate),
    };
  }

  if (input.termMonths === undefined) {
    throw new Error("termMonths or leaseEndDate is required");
  }

  return {
    leaseEndDate: calculateLeaseEndDate(leaseStartDate, input.termMonths),
    termMonths: input.termMonths,
  };
}

export function validateLeaseTermInput(input: IResolveLeaseEndDateInput): string | null {
  const leaseStartDate = parseLeaseIsoDate(input.leaseStartDate);
  if (!leaseStartDate) {
    return "leaseStartDate must be a YYYY-MM-DD date";
  }

  const hasCustomEnd = input.leaseEndDate !== undefined && input.leaseEndDate !== "";
  const hasTermMonths = input.termMonths !== undefined;

  if (!hasCustomEnd && !hasTermMonths) {
    return "termMonths or leaseEndDate is required";
  }

  if (hasCustomEnd) {
    const leaseEndDate = parseLeaseIsoDate(input.leaseEndDate ?? "");
    if (!leaseEndDate) {
      return "leaseEndDate must be a YYYY-MM-DD date";
    }

    if (leaseEndDate < leaseStartDate) {
      return "Lease end date cannot be before the lease start date";
    }

    const derivedTermMonths = deriveTermMonthsFromDates(leaseStartDate, leaseEndDate);
    if (derivedTermMonths < 1 || derivedTermMonths > MAX_LEASE_TERM_MONTHS) {
      return `Lease span must be between 1 and ${MAX_LEASE_TERM_MONTHS} months`;
    }

    return null;
  }

  if (
    !Number.isInteger(input.termMonths) ||
    input.termMonths! < 1 ||
    input.termMonths! > MAX_LEASE_TERM_MONTHS
  ) {
    return `termMonths must be a whole number between 1 and ${MAX_LEASE_TERM_MONTHS}`;
  }

  return null;
}

export function isCustomLeaseEndDate(
  leaseStartDate: string,
  termMonths: number,
  leaseEndDate: string
): boolean {
  return leaseEndDate !== calculateLeaseEndDate(leaseStartDate, termMonths);
}

export type IResolvedExtendLeaseTerm = {
  newLeaseEndDate: string;
  newTermMonths: number;
};

export function resolveExtendLeaseEndDate(
  lease: Pick<IPropertyLongStay, "leaseEndDate" | "leaseStartDate" | "termMonths">,
  body: IExtendPropertyLongStayBody
): IResolvedExtendLeaseTerm {
  if (body.newLeaseEndDate !== undefined) {
    const newLeaseEndDate = parseLeaseIsoDate(body.newLeaseEndDate);
    if (!newLeaseEndDate) {
      throw new Error("newLeaseEndDate must be a YYYY-MM-DD date");
    }

    return {
      newLeaseEndDate,
      newTermMonths: deriveTermMonthsFromDates(lease.leaseStartDate, newLeaseEndDate),
    };
  }

  if (body.additionalTermMonths === undefined) {
    throw new Error("additionalTermMonths or newLeaseEndDate is required");
  }

  return {
    newLeaseEndDate: calculateLeaseEndDate(
      addDaysToIsoDate(lease.leaseEndDate, 1),
      body.additionalTermMonths
    ),
    newTermMonths: lease.termMonths + body.additionalTermMonths,
  };
}
