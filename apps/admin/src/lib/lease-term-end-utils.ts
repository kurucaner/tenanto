import { type z } from "zod";

import {
  calculateLeaseEndDateFromWeeks,
  deriveTermWeeksFromDates,
  isCustomLeaseEndDate,
  isStandardWeeklyLeaseEndDate,
  type LeaseTermInputMode,
  MAX_LEASE_TERM_WEEKS,
  parseRentBillingCadence,
  RentBillingCadence,
  resolveLeaseEndDate,
  type TRentBillingCadence,
  validateLeaseTermInput,
} from "@/packages/shared";

export type TLeaseTermEndFormValues = {
  leaseEndDate: string;
  leaseStartDate: string;
  termMode: LeaseTermInputMode;
  termMonths: string;
  termWeeks: string;
};

export function refineLeaseTermEndFormValues(
  values: TLeaseTermEndFormValues,
  ctx: z.RefinementCtx,
  errorPath: "leaseEndDate" | "termMonths" | "termWeeks" = "termMonths"
): void {
  if (values.termMode === "customEnd" && values.leaseEndDate === "") {
    ctx.addIssue({
      code: "custom",
      message: "Lease end date is required",
      path: ["leaseEndDate"],
    });
    return;
  }

  if (values.termMode === "weeks") {
    const termWeeks = Number.parseInt(values.termWeeks, 10);
    if (
      !Number.isInteger(termWeeks) ||
      termWeeks < 1 ||
      termWeeks > MAX_LEASE_TERM_WEEKS
    ) {
      ctx.addIssue({
        code: "custom",
        message: `Number of weeks must be a whole number between 1 and ${MAX_LEASE_TERM_WEEKS}`,
        path: ["termWeeks"],
      });
      return;
    }
  }

  const payload = buildLeaseTermApiPayload(values);
  const error = validateLeaseTermInput(payload);
  if (error) {
    const path =
      values.termMode === "customEnd"
        ? "leaseEndDate"
        : values.termMode === "weeks"
          ? "termWeeks"
          : errorPath;
    ctx.addIssue({
      code: "custom",
      message: error,
      path: [path],
    });
  }
}

export function buildLeaseTermApiPayload(values: TLeaseTermEndFormValues): {
  leaseEndDate?: string;
  leaseStartDate: string;
  termMonths?: number;
} {
  if (values.termMode === "customEnd") {
    return {
      leaseEndDate: values.leaseEndDate,
      leaseStartDate: values.leaseStartDate,
    };
  }

  if (values.termMode === "weeks") {
    const termWeeks = Number.parseInt(values.termWeeks, 10);
    return {
      leaseEndDate: calculateLeaseEndDateFromWeeks(values.leaseStartDate, termWeeks),
      leaseStartDate: values.leaseStartDate,
    };
  }

  return {
    leaseStartDate: values.leaseStartDate,
    termMonths: Number.parseInt(values.termMonths, 10),
  };
}

export function resolveLeaseTermEndPreview(values: TLeaseTermEndFormValues): string | null {
  try {
    return resolveLeaseEndDate(buildLeaseTermApiPayload(values)).leaseEndDate;
  } catch {
    return null;
  }
}

export function getInitialLeaseTermEndValues(input: {
  leaseEndDate: string;
  leaseStartDate: string;
  rentBillingCadence?: TRentBillingCadence | null;
  termMonths: number;
}): TLeaseTermEndFormValues {
  const cadence = parseRentBillingCadence(input.rentBillingCadence) ?? RentBillingCadence.MONTHLY;

  if (cadence === RentBillingCadence.WEEKLY) {
    const usesCustomEnd = !isStandardWeeklyLeaseEndDate(
      input.leaseStartDate,
      input.leaseEndDate
    );

    if (usesCustomEnd) {
      return {
        leaseEndDate: input.leaseEndDate,
        leaseStartDate: input.leaseStartDate,
        termMode: "customEnd",
        termMonths: String(input.termMonths),
        termWeeks: "",
      };
    }

    return {
      leaseEndDate: input.leaseEndDate,
      leaseStartDate: input.leaseStartDate,
      termMode: "weeks",
      termMonths: String(input.termMonths),
      termWeeks: String(deriveTermWeeksFromDates(input.leaseStartDate, input.leaseEndDate)),
    };
  }

  const usesCustomEnd = isCustomLeaseEndDate(
    input.leaseStartDate,
    input.termMonths,
    input.leaseEndDate
  );

  return {
    leaseEndDate: input.leaseEndDate,
    leaseStartDate: input.leaseStartDate,
    termMode: usesCustomEnd ? "customEnd" : "months",
    termMonths: String(input.termMonths),
    termWeeks: "",
  };
}
