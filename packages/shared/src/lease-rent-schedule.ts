import { enumerateLeaseMonths, enumerateLeaseWeeks } from "./lease-date-utils";
import { calculateExpectedRentForLeaseMonth } from "./lease-proration-utils";
import { getEffectiveRentPeriodMonth, rollupLeaseRentByPeriod } from "./lease-rent-period-rollup";
import { getLeaseRentForPeriod } from "./lease-rent-utils";
import { calculateExpectedRentForLeaseWeek } from "./lease-week-proration-utils";
import type { IPropertyIncomeLine } from "./property-income-line-types";
import type {
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStayRentPeriod,
} from "./property-long-stay-types";
import { getReportableIncomeLineAmounts } from "./property-partial-refund-utils";
import { isWeeklyRentBillingCadence } from "./rent-billing-cadence";
import { getLeaseRentAmount, withRentScheduleNeutralFields } from "./rent-period-field-utils";

function indexFirstIncomeLineIdByPeriod(
  incomeLines: readonly IPropertyIncomeLine[],
  schedulePeriods: readonly string[]
): Map<string, string> {
  const byPeriod = new Map<string, string>();

  for (const line of incomeLines) {
    if (line.isDeleted) {
      continue;
    }

    if (getReportableIncomeLineAmounts(line).netIncome <= 0) {
      continue;
    }

    const period = getEffectiveRentPeriodMonth({
      rentPeriodMonth: line.rentPeriodMonth,
      schedulePeriods,
      transactionDate: line.transactionDate,
    });
    if (!byPeriod.has(period)) {
      byPeriod.set(period, line.id);
    }
  }

  return byPeriod;
}

export function enumerateLeaseSchedulePeriods(
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "rentBillingCadence">,
  effectiveEndDate: string
): string[] {
  return isWeeklyRentBillingCadence(lease.rentBillingCadence)
    ? enumerateLeaseWeeks(lease.leaseStartDate, effectiveEndDate)
    : enumerateLeaseMonths(lease.leaseStartDate, effectiveEndDate);
}

function buildSchedulePeriodExpectations(input: {
  effectiveEndDate: string;
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent" | "rentBillingCadence">;
  periodKeys: readonly string[];
  rentPeriods: readonly IPropertyLongStayRentPeriod[];
}): Array<{
  daysInMonth: number;
  expectedRent: number;
  isProrated: boolean;
  month: string;
  occupiedDays: number;
}> {
  const isWeekly = isWeeklyRentBillingCadence(input.lease.rentBillingCadence);

  return input.periodKeys.map((periodKey) => {
    const baseRentAmount = getLeaseRentAmount(input.lease);

    if (isWeekly) {
      const weeklyRent = getLeaseRentForPeriod(baseRentAmount, input.rentPeriods, periodKey);
      const proration = calculateExpectedRentForLeaseWeek({
        effectiveEndDate: input.effectiveEndDate,
        leaseStartDate: input.lease.leaseStartDate,
        periodStart: periodKey,
        weeklyRent,
      });

      return {
        daysInMonth: proration.daysInPeriod,
        expectedRent: proration.expectedRent,
        isProrated: proration.isProrated,
        month: periodKey,
        occupiedDays: proration.occupiedDays,
      };
    }

    const proration = calculateExpectedRentForLeaseMonth({
      baseMonthlyRent: baseRentAmount,
      effectiveEndDate: input.effectiveEndDate,
      leaseStartDate: input.lease.leaseStartDate,
      month: periodKey,
      rentPeriods: input.rentPeriods,
    });

    return {
      daysInMonth: proration.daysInMonth,
      expectedRent: proration.expectedRent,
      isProrated: proration.isProrated,
      month: periodKey,
      occupiedDays: proration.occupiedDays,
    };
  });
}

export function buildLeaseRentSchedule(input: {
  allocationCentsByMonth: ReadonlyMap<string, number>;
  effectiveEndDate: string;
  incomeLines: readonly IPropertyIncomeLine[];
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent" | "rentBillingCadence">;
  rentPeriods: readonly IPropertyLongStayRentPeriod[];
}): IPropertyLongStayRentMonth[] {
  return buildLeaseRentScheduleWithRollup({
    ...input,
    months: enumerateLeaseSchedulePeriods(input.lease, input.effectiveEndDate),
  });
}

/** @deprecated Prefer `buildLeaseRentSchedule` — kept for callers passing explicit period keys. */
export function buildLeaseRentScheduleWithRollup(input: {
  allocationCentsByMonth: ReadonlyMap<string, number>;
  effectiveEndDate: string;
  incomeLines: readonly IPropertyIncomeLine[];
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent" | "rentBillingCadence">;
  months: readonly string[];
  rentPeriods: readonly IPropertyLongStayRentPeriod[];
}): IPropertyLongStayRentMonth[] {
  const scheduleMonths = buildSchedulePeriodExpectations({
    effectiveEndDate: input.effectiveEndDate,
    lease: input.lease,
    periodKeys: input.months,
    rentPeriods: input.rentPeriods,
  });

  const allocations = input.months.flatMap((month) => {
    const allocatedCents = input.allocationCentsByMonth.get(month) ?? 0;
    if (allocatedCents <= 0) {
      return [];
    }
    return [{ allocatedCents, month }];
  });

  const rolledUp = rollupLeaseRentByPeriod({
    allocations,
    incomeLines: input.incomeLines,
    scheduleMonths,
  });

  const incomeLineIdByPeriod = indexFirstIncomeLineIdByPeriod(input.incomeLines, input.months);
  const prorationByMonth = new Map(scheduleMonths.map((item) => [item.month, item]));

  return rolledUp.map((item) => {
    const proration = prorationByMonth.get(item.month);
    const incomeLineId = incomeLineIdByPeriod.get(item.month);

    return withRentScheduleNeutralFields({
      daysInMonth: proration?.daysInMonth ?? 0,
      expectedRent: item.expectedRent,
      incomeLineId,
      isPaid: item.isPaid,
      isProrated: proration?.isProrated ?? false,
      month: item.month,
      occupiedDays: proration?.occupiedDays ?? 0,
      paidRent: item.paidRent,
      remainingRent: item.remainingRent,
    });
  });
}
