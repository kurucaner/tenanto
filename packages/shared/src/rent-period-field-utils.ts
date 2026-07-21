import type {
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
  return period.effectiveFromPeriod ?? period.effectiveFromMonth;
}

export function getRentPeriodAmount(
  period: Pick<IPropertyLongStayRentPeriod, "monthlyRent" | "rentAmount">
): TRentAmount {
  return period.rentAmount ?? period.monthlyRent;
}

export function getRentSchedulePeriodKey(
  item: Pick<IPropertyLongStayRentMonth, "month" | "periodKey">
): TRentPeriodKey {
  return item.periodKey ?? item.month;
}

export function getLeaseRentAmount(
  lease: Pick<IPropertyLongStay, "monthlyRent" | "rentAmount">
): TRentAmount {
  return lease.rentAmount ?? lease.monthlyRent;
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
  body: Pick<{ monthlyRent: number; rentAmount?: number }, "monthlyRent" | "rentAmount">
): TRentAmount {
  return body.rentAmount ?? body.monthlyRent;
}

export function withRentPeriodNeutralFields(
  period: IPropertyLongStayRentPeriod
): IPropertyLongStayRentPeriod {
  const effectiveFromPeriod = getRentPeriodEffectiveFrom(period);
  const rentAmount = getRentPeriodAmount(period);

  return {
    ...period,
    effectiveFromMonth: effectiveFromPeriod,
    effectiveFromPeriod,
    monthlyRent: rentAmount,
    rentAmount,
  };
}

export function withRentScheduleNeutralFields(
  item: IPropertyLongStayRentMonth
): IPropertyLongStayRentMonth {
  const periodKey = getRentSchedulePeriodKey(item);

  return {
    ...item,
    month: periodKey,
    periodKey,
  };
}

export function withLeaseRentAmountNeutralFields(lease: IPropertyLongStay): IPropertyLongStay {
  const rentAmount = getLeaseRentAmount(lease);

  return {
    ...lease,
    monthlyRent: rentAmount,
    rentAmount,
  };
}
