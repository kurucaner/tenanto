import { type IPropertyLongStayRentMonth } from "@/packages/shared";

export type TLeaseRentScheduleMonthAmount = Pick<
  IPropertyLongStayRentMonth,
  "expectedRent" | "month"
>;

export interface ILeaseRentSchedulePartition {
  paidMonths: IPropertyLongStayRentMonth[];
  unpaidMonths: IPropertyLongStayRentMonth[];
  unpaidSummary: {
    count: number;
    totalExpected: number;
  };
}

export function partitionRentSchedule(
  rentSchedule: readonly IPropertyLongStayRentMonth[]
): ILeaseRentSchedulePartition {
  const unpaidMonths = rentSchedule.filter((item) => !item.isPaid);
  const paidMonths = rentSchedule.filter((item) => item.isPaid);
  const totalExpected = unpaidMonths.reduce((sum, item) => sum + item.expectedRent, 0);

  return {
    paidMonths,
    unpaidMonths,
    unpaidSummary: { count: unpaidMonths.length, totalExpected },
  };
}

export function getExpectedRentForScheduleMonth(
  rentSchedule: readonly TLeaseRentScheduleMonthAmount[],
  month: string
): number | undefined {
  return rentSchedule.find((item) => item.month === month)?.expectedRent;
}
