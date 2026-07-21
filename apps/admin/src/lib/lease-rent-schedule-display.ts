import {
  enumerateLeaseWeeks,
  formatRentPeriodLabel,
  inferRentScheduleCadence,
  isPeriodKeyAfter,
  isPeriodKeyOnOrBefore,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  RentBillingCadence,
  resolveAsOfPeriodKey,
  transactionDateToMonth,
  type IPropertyLongStayRentMonth,
  type TRentBillingCadence,
} from "@/packages/shared";

export type TLeaseRentScheduleMonthAmount = Pick<
  IPropertyLongStayRentMonth,
  "expectedRent" | "month" | "paidRent" | "remainingRent"
>;

export interface ILeaseRentSchedulePartition {
  dueUnpaidMonths: IPropertyLongStayRentMonth[];
  paidMonths: IPropertyLongStayRentMonth[];
  unpaidSummary: {
    count: number;
    totalRemaining: number;
  };
  upcomingMonths: IPropertyLongStayRentMonth[];
}

export function formatRentSchedulePeriodLabel(periodKey: string): string {
  return formatRentPeriodLabel(periodKey);
}

export function getLeaseRentAmountSuffix(cadence: TRentBillingCadence): string {
  return cadence === RentBillingCadence.WEEKLY ? "/wk" : "/mo";
}

export function getLeaseBillingCadenceLabel(cadence: TRentBillingCadence): string {
  return cadence === RentBillingCadence.WEEKLY ? "Weekly" : "Monthly";
}

export function getLeaseTermDisplayLabel(
  lease: Pick<
    IPropertyLongStay,
    "leaseEndDate" | "leaseStartDate" | "rentBillingCadence" | "termMonths"
  >
): string {
  if (lease.rentBillingCadence === RentBillingCadence.WEEKLY) {
    const weekCount = enumerateLeaseWeeks(lease.leaseStartDate, lease.leaseEndDate).length;
    return `${weekCount} weeks`;
  }

  return `${lease.termMonths} months`;
}

export function getLeaseExtendTermsDescription(cadence: TRentBillingCadence): string {
  if (cadence === RentBillingCadence.WEEKLY) {
    return "Extend the lease term by adding weeks. Rent amount cannot be changed during extension.";
  }

  return "Extend the lease term by adding months. You can optionally set a new monthly rent effective from a month in the extension period.";
}

export function getLeaseEditTermsDescription(cadence: TRentBillingCadence): string {
  if (cadence === RentBillingCadence.WEEKLY) {
    return "Correct the lease start date, term, or base weekly rent before any rent is recorded.";
  }

  return "Correct the lease start date, term, or base monthly rent before any rent is recorded.";
}

export function getVisibleLeaseRentPeriods(
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent" | "rentBillingCadence">,
  rentPeriods: readonly IPropertyLongStayRentPeriod[]
): IPropertyLongStayRentPeriod[] {
  if (rentPeriods.length !== 1) {
    return [...rentPeriods];
  }

  const [period] = rentPeriods;
  if (!period || period.monthlyRent !== lease.monthlyRent) {
    return [...rentPeriods];
  }

  if (lease.rentBillingCadence === RentBillingCadence.WEEKLY) {
    return period.effectiveFromMonth === lease.leaseStartDate ? [] : [...rentPeriods];
  }

  return period.effectiveFromMonth === transactionDateToMonth(lease.leaseStartDate)
    ? []
    : [...rentPeriods];
}

export function inferRentScheduleCadenceFromItems(
  rentSchedule: readonly Pick<IPropertyLongStayRentMonth, "month">[]
): ReturnType<typeof inferRentScheduleCadence> {
  return inferRentScheduleCadence(rentSchedule.map((item) => item.month));
}

export function getRentSchedulePeriodPluralLabel(
  cadence: ReturnType<typeof inferRentScheduleCadence>
): string {
  return cadence === "weekly" ? "weeks" : "months";
}

export function getRentSchedulePeriodSingularLabel(
  cadence: ReturnType<typeof inferRentScheduleCadence>
): string {
  return cadence === "weekly" ? "week" : "month";
}

export function resolveRentScheduleAsOfKey(
  rentSchedule: readonly Pick<IPropertyLongStayRentMonth, "month">[],
  referenceDate: string
): string {
  return resolveAsOfPeriodKey(
    referenceDate,
    rentSchedule.map((item) => item.month)
  );
}

export function isRentMonthPartiallyPaid(
  item: Pick<IPropertyLongStayRentMonth, "isPaid" | "paidRent">
): boolean {
  return !item.isPaid && item.paidRent > 0;
}

export function hasOutstandingRent(
  item: Pick<IPropertyLongStayRentMonth, "remainingRent">
): boolean {
  return item.remainingRent > 0;
}

export function partitionRentSchedule(
  rentSchedule: readonly IPropertyLongStayRentMonth[],
  asOfReferenceDate: string
): ILeaseRentSchedulePartition {
  const asOfKey = resolveRentScheduleAsOfKey(rentSchedule, asOfReferenceDate);
  const paidMonths = rentSchedule.filter((item) => item.isPaid);
  const unpaid = rentSchedule.filter((item) => !item.isPaid);
  const dueUnpaidMonths = unpaid.filter((item) => isPeriodKeyOnOrBefore(item.month, asOfKey));
  const upcomingMonths = unpaid.filter((item) => isPeriodKeyAfter(item.month, asOfKey));
  const totalRemaining = dueUnpaidMonths.reduce((sum, item) => sum + item.remainingRent, 0);

  return {
    dueUnpaidMonths,
    paidMonths,
    unpaidSummary: { count: dueUnpaidMonths.length, totalRemaining },
    upcomingMonths,
  };
}

export function getExpectedRentForScheduleMonth(
  rentSchedule: readonly TLeaseRentScheduleMonthAmount[],
  month: string
): number | undefined {
  return rentSchedule.find((item) => item.month === month)?.expectedRent;
}

export function getRemainingRentForScheduleMonth(
  rentSchedule: readonly TLeaseRentScheduleMonthAmount[],
  month: string
): number | undefined {
  return rentSchedule.find((item) => item.month === month)?.remainingRent;
}
