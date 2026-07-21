import { describe, expect, test } from "bun:test";
import { type UseFormReturn } from "react-hook-form";

import {
  applyStartLeaseStepValidationErrors,
  DEFAULT_START_LEASE_TERM_MONTHS,
  getStartLeaseDefaultValues,
  type TStartLeaseFormField,
  type TStartLeaseFormValues,
  validateStartLeaseStep,
} from "./start-lease-form-schema";

describe("getStartLeaseDefaultValues", () => {
  test("prefills unitId when provided", () => {
    expect(getStartLeaseDefaultValues("unit-42").unitId).toBe("unit-42");
  });

  test("uses default term months and empty tenant fields", () => {
    const values = getStartLeaseDefaultValues();
    expect(values.termMonths).toBe(DEFAULT_START_LEASE_TERM_MONTHS);
    expect(values.rentBillingCadence).toBe("monthly");
    expect(values.guestName).toBe("");
    expect(values.rentAmount).toBe("");
    expect(values.unitId).toBe("");
  });
});

describe("validateStartLeaseStep", () => {
  test("term step passes without monthly rent", () => {
    const values = getStartLeaseDefaultValues("unit-42");
    values.guestName = "Caner";

    expect(validateStartLeaseStep("term", values).success).toBe(true);
  });

  test("rent step fails without monthly rent", () => {
    const values = getStartLeaseDefaultValues("unit-42");
    values.guestName = "Caner";

    expect(validateStartLeaseStep("rent", values).success).toBe(false);
  });
});

describe("applyStartLeaseStepValidationErrors", () => {
  test("maps who-step zod issues onto react-hook-form fields", () => {
    const setErrorCalls: Array<{ field: TStartLeaseFormField; message: string }> = [];
    const form = {
      clearErrors: () => {},
      setError: (field: TStartLeaseFormField, error: { message?: string }) => {
        setErrorCalls.push({ field, message: error.message ?? "" });
      },
    } as unknown as UseFormReturn<TStartLeaseFormValues>;

    const result = validateStartLeaseStep("who", getStartLeaseDefaultValues());
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    applyStartLeaseStepValidationErrors(form, "who", result.error);

    expect(setErrorCalls).toEqual(
      expect.arrayContaining([
        { field: "unitId", message: "Unit is required" },
        { field: "guestName", message: "Primary tenant name is required" },
      ])
    );
  });
});
