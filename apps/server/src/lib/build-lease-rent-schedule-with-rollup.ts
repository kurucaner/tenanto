import type {
  IPropertyIncomeLine,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStayRentPeriod,
} from "@/packages/shared";
import {
  calculateExpectedRentForLeaseMonth,
  getEffectiveRentPeriodMonth,
  getReportableIncomeLineAmounts,
  rollupLeaseRentByPeriod,
} from "@/packages/shared";

function indexFirstIncomeLineIdByPeriod(
  incomeLines: readonly IPropertyIncomeLine[]
): Map<string, string> {
  const byPeriod = new Map<string, string>();

  for (const line of incomeLines) {
    if (line.isDeleted) {
      continue;
    }

    if (getReportableIncomeLineAmounts(line).netIncome <= 0) {
      continue;
    }

    const period = getEffectiveRentPeriodMonth(line);
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
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent">;
  months: readonly string[];
  rentPeriods: readonly IPropertyLongStayRentPeriod[];
}): IPropertyLongStayRentMonth[] {
  const scheduleMonths = input.months.map((month) => {
    const proration = calculateExpectedRentForLeaseMonth({
      baseMonthlyRent: input.lease.monthlyRent,
      effectiveEndDate: input.effectiveEndDate,
      leaseStartDate: input.lease.leaseStartDate,
      month,
      rentPeriods: input.rentPeriods,
    });

    return {
      daysInMonth: proration.daysInMonth,
      expectedRent: proration.expectedRent,
      isProrated: proration.isProrated,
      month,
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

  const incomeLineIdByPeriod = indexFirstIncomeLineIdByPeriod(input.incomeLines);
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
