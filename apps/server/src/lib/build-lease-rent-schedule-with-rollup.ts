import type {
  IPropertyIncomeLine,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStayRentPeriod,
} from "@/packages/shared";
import {
  calculateExpectedRentForLeaseMonth,
  calculateExpectedRentForLeaseWeek,
  getEffectiveRentPeriodMonth,
  getLeaseRentForMonth,
  getReportableIncomeLineAmounts,
  RentBillingCadence,
  rollupLeaseRentByPeriod,
} from "@/packages/shared";

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

export function buildLeaseRentScheduleWithRollup(input: {
  allocationCentsByMonth: ReadonlyMap<string, number>;
  effectiveEndDate: string;
  incomeLines: readonly IPropertyIncomeLine[];
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent" | "rentBillingCadence">;
  months: readonly string[];
  rentPeriods: readonly IPropertyLongStayRentPeriod[];
}): IPropertyLongStayRentMonth[] {
  const isWeekly = input.lease.rentBillingCadence === RentBillingCadence.WEEKLY;

  const scheduleMonths = input.months.map((periodKey) => {
    if (isWeekly) {
      const weeklyRent = getLeaseRentForMonth(
        input.lease.monthlyRent,
        input.rentPeriods,
        periodKey
      );
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
      baseMonthlyRent: input.lease.monthlyRent,
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

    return {
      daysInMonth: proration?.daysInMonth ?? 0,
      expectedRent: item.expectedRent,
      incomeLineId,
      isPaid: item.isPaid,
      isProrated: proration?.isProrated ?? false,
      month: item.month,
      occupiedDays: proration?.occupiedDays ?? 0,
      paidRent: item.paidRent,
      remainingRent: item.remainingRent,
    };
  });
}
