import type {
  ICreatePropertyLongStayBody,
  IEditPropertyLongStayTermsBody,
  IExtendPropertyLongStayBody,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStayRentPeriod,
} from "./property-long-stay-types";

/** Schedule period key: `YYYY-MM` (monthly cadence) or `YYYY-MM-DD` week start (weekly cadence). */
export type TRentPeriodKey = string;

/** Recurring rent amount for the lease billing cadence (weekly or monthly). */
export type TRentAmount = number;

export function getRentPeriodEffectiveFrom(
  period: Pick<IPropertyLongStayRentPeriod, "effectiveFromMonth" | "effectiveFromPeriod">
): TRentPeriodKey {
  return period.effectiveFromPeriod ?? period.effectiveFromMonth ?? "";
}

export function getRentPeriodAmount(
  period: Pick<IPropertyLongStayRentPeriod, "monthlyRent" | "rentAmount">
): TRentAmount {
  return period.rentAmount ?? period.monthlyRent ?? 0;
}

export function getRentSchedulePeriodKey(
  item: Pick<IPropertyLongStayRentMonth, "month" | "periodKey">
): TRentPeriodKey {
  return item.periodKey ?? item.month ?? "";
}

export function getLeaseRentAmount(
  lease: Pick<IPropertyLongStay, "monthlyRent" | "rentAmount">
): TRentAmount {
  return lease.rentAmount ?? lease.monthlyRent ?? 0;
}

export function resolveCreateLeaseRentAmount(
  body: Pick<ICreatePropertyLongStayBody, "monthlyRent" | "rentAmount">
): TRentAmount | undefined {
  if (body.rentAmount !== undefined) {
    return body.rentAmount;
  }

  return body.monthlyRent;
}

export function resolveExtendRentEffectivePeriod(
  body: Pick<IExtendPropertyLongStayBody, "rentEffectiveFromMonth" | "rentEffectiveFromPeriod">
): TRentPeriodKey | undefined {
  return body.rentEffectiveFromPeriod ?? body.rentEffectiveFromMonth;
}

export function resolveExtendNewRentAmount(
  body: Pick<IExtendPropertyLongStayBody, "newMonthlyRent" | "newRentAmount">
): TRentAmount | undefined {
  return body.newRentAmount ?? body.newMonthlyRent;
}

export function resolveTermsEditRentAmount(
  body: Pick<IEditPropertyLongStayTermsBody, "monthlyRent" | "rentAmount">
): TRentAmount {
  return body.rentAmount ?? body.monthlyRent ?? 0;
}

export function resolveIncomeLineRentPeriodKey(
  body: Pick<{ rentPeriodKey?: string | null; rentPeriodMonth?: string | null }, "rentPeriodKey" | "rentPeriodMonth">
): string | null | undefined {
  if (body.rentPeriodKey !== undefined) {
    return body.rentPeriodKey;
  }

  return body.rentPeriodMonth;
}

export function withRentPeriodLegacyShims(
  period: IPropertyLongStayRentPeriod
): IPropertyLongStayRentPeriod {
  const effectiveFromPeriod = getRentPeriodEffectiveFrom(period);
  const rentAmount = getRentPeriodAmount(period);

  return {
    effectiveFromPeriod,
    rentAmount,
    effectiveFromMonth: effectiveFromPeriod,
    monthlyRent: rentAmount,
  };
}

export function withRentScheduleLegacyShims(
  item: IPropertyLongStayRentMonth
): IPropertyLongStayRentMonth {
  const periodKey = getRentSchedulePeriodKey(item);

  return {
    ...item,
    periodKey,
    month: periodKey,
  };
}

export function withLeaseRentLegacyShims(lease: IPropertyLongStay): IPropertyLongStay {
  const rentAmount = getLeaseRentAmount(lease);

  return {
    ...lease,
    rentAmount,
    monthlyRent: rentAmount,
  };
}

/** @deprecated Use `withRentPeriodLegacyShims`. */
export const withRentPeriodNeutralFields = withRentPeriodLegacyShims;

/** @deprecated Use `withRentScheduleLegacyShims`. */
export const withRentScheduleNeutralFields = withRentScheduleLegacyShims;

/** @deprecated Use `withLeaseRentLegacyShims`. */
export const withLeaseRentAmountNeutralFields = withLeaseRentLegacyShims;
