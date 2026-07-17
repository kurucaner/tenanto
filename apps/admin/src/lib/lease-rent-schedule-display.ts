import { type IPropertyLongStayRentMonth } from "@/packages/shared";

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
  asOfMonth: string
): ILeaseRentSchedulePartition {
  const paidMonths = rentSchedule.filter((item) => item.isPaid);
  const unpaid = rentSchedule.filter((item) => !item.isPaid);
  const dueUnpaidMonths = unpaid.filter((item) => item.month <= asOfMonth);
  const upcomingMonths = unpaid.filter((item) => item.month > asOfMonth);
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
