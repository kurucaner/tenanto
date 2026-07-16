import { type IPropertyLongStayRentMonth } from "@/packages/shared";

export type TLeaseRentScheduleMonthAmount = Pick<
  IPropertyLongStayRentMonth,
  "expectedRent" | "month"
>;

export interface ILeaseRentSchedulePartition {
  dueUnpaidMonths: IPropertyLongStayRentMonth[];
  paidMonths: IPropertyLongStayRentMonth[];
  upcomingMonths: IPropertyLongStayRentMonth[];
  unpaidSummary: {
    count: number;
    totalExpected: number;
  };
}

export function partitionRentSchedule(
  rentSchedule: readonly IPropertyLongStayRentMonth[],
  asOfMonth: string
): ILeaseRentSchedulePartition {
  const paidMonths = rentSchedule.filter((item) => item.isPaid);
  const unpaid = rentSchedule.filter((item) => !item.isPaid);
  const dueUnpaidMonths = unpaid.filter((item) => item.month <= asOfMonth);
  const upcomingMonths = unpaid.filter((item) => item.month > asOfMonth);
  const totalExpected = dueUnpaidMonths.reduce((sum, item) => sum + item.expectedRent, 0);

  return {
    dueUnpaidMonths,
    paidMonths,
    upcomingMonths,
    unpaidSummary: { count: dueUnpaidMonths.length, totalExpected },
  };
}

export function getExpectedRentForScheduleMonth(
  rentSchedule: readonly TLeaseRentScheduleMonthAmount[],
  month: string
): number | undefined {
  return rentSchedule.find((item) => item.month === month)?.expectedRent;
}
