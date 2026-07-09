import { z } from "zod";

import { isValidDecimalInput } from "@/lib/decimal-input-utils";

export function parseMoneyInput(value: string): number | null {
  if (!isValidDecimalInput(value) || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPositiveMoneyInput(value: string): boolean {
  const parsed = parseMoneyInput(value);
  return parsed !== null && parsed > 0;
}

export function isNonNegativeMoneyInput(value: string): boolean {
  const parsed = parseMoneyInput(value);
  return parsed !== null && parsed >= 0;
}

export function isOptionalNonNegativeMoneyInput(value: string): boolean {
  if (value === "") {
    return true;
  }
  return isNonNegativeMoneyInput(value);
}

export function requiredPositiveMoneyField(label: string) {
  return z
    .string()
    .min(1, `${label} is required`)
    .refine(isPositiveMoneyInput, {
      message: `${label} must be greater than 0`,
    });
}

export function requiredNonNegativeMoneyField(label: string) {
  return z
    .string()
    .min(1, `${label} is required`)
    .refine(isNonNegativeMoneyInput, {
      message: `${label} must be a non-negative number`,
    });
}

export function optionalNonNegativeMoneyField(invalidMessage: string) {
  return z.string().refine(isOptionalNonNegativeMoneyInput, { message: invalidMessage });
}
