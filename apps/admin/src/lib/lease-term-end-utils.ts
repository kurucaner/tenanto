import { type z } from "zod";

import {
  isCustomLeaseEndDate,
  type LeaseTermInputMode,
  resolveLeaseEndDate,
  validateLeaseTermInput,
} from "@/packages/shared";

export type TLeaseTermEndFormValues = {
  leaseEndDate: string;
  leaseStartDate: string;
  termMode: LeaseTermInputMode;
  termMonths: string;
};

export function refineLeaseTermEndFormValues(
  values: TLeaseTermEndFormValues,
  ctx: z.RefinementCtx,
  errorPath: "leaseEndDate" | "termMonths" = "termMonths"
): void {
  if (values.termMode === "customEnd" && values.leaseEndDate === "") {
    ctx.addIssue({
      code: "custom",
      message: "Lease end date is required",
      path: ["leaseEndDate"],
    });
    return;
  }

  const payload = buildLeaseTermApiPayload(values);
  const error = validateLeaseTermInput(payload);
  if (error) {
    ctx.addIssue({
      code: "custom",
      message: error,
      path: [values.termMode === "customEnd" ? "leaseEndDate" : errorPath],
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
  termMonths: number;
}): TLeaseTermEndFormValues {
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
  };
}
