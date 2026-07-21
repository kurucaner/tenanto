import {
  enumerateLeaseWeeks,
  getLeaseRentAmount,
  getPristineRentPeriodKey,
  getRentPeriodAmount,
  getRentPeriodEffectiveFrom,
  getRentSchedulePeriodKey,
  inferRentScheduleCadence,
  type IPropertyLongStay,
  type IPropertyLongStayRentMonth,
  type IPropertyLongStayRentPeriod,
  isPeriodKeyAfter,
  isPeriodKeyOnOrBefore,
  RentBillingCadence,
  resolveAsOfPeriodKey,
  type TRentBillingCadence,
} from "@/packages/shared";

export type TLeaseRentSchedulePeriodAmount = Pick<
  IPropertyLongStayRentMonth,
  "expectedRent" | "paidRent" | "periodKey" | "remainingRent"
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
    return "Extend the lease term by adding weeks. You can optionally set a new weekly rent effective from a week in the extension period.";
  }

  return "Extend the lease term by adding months. You can optionally set a new monthly rent effective from a month in the extension period.";
}

export function getExtendLeaseDialogDescription(cadence: TRentBillingCadence): string {
  const rentCadenceLabel = cadence === RentBillingCadence.WEEKLY ? "weekly" : "monthly";

  return `Extend this lease from the current contract end. You can optionally set a new ${rentCadenceLabel} rent for the extension period.`;
}

export function getExtendLeaseChangeRentLabel(cadence: TRentBillingCadence): string {
  return cadence === RentBillingCadence.WEEKLY
    ? "Change weekly rent for extension"
    : "Change monthly rent for extension";
}

export function getExtendLeaseNewRentLabel(cadence: TRentBillingCadence): string {
  return cadence === RentBillingCadence.WEEKLY ? "New weekly rent" : "New monthly rent";
}

export function getLeaseEditTermsDescription(cadence: TRentBillingCadence): string {
  if (cadence === RentBillingCadence.WEEKLY) {
    return "Correct the lease start date, term, or base weekly rent before any rent is recorded.";
  }

  return "Correct the lease start date, term, or base monthly rent before any rent is recorded.";
}

export function getVisibleLeaseRentPeriods(
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "rentAmount" | "rentBillingCadence">,
  rentPeriods: readonly IPropertyLongStayRentPeriod[]
): IPropertyLongStayRentPeriod[] {
  if (rentPeriods.length !== 1) {
    return [...rentPeriods];
  }

  const [period] = rentPeriods;
  if (!period || getRentPeriodAmount(period) !== getLeaseRentAmount(lease)) {
    return [...rentPeriods];
  }

  const pristineKey = getPristineRentPeriodKey(lease.leaseStartDate, lease.rentBillingCadence);

  return getRentPeriodEffectiveFrom(period) === pristineKey ? [] : [...rentPeriods];
}

export function inferRentScheduleCadenceFromItems(
  rentSchedule: readonly Pick<IPropertyLongStayRentMonth, "month" | "periodKey">[]
): ReturnType<typeof inferRentScheduleCadence> {
  return inferRentScheduleCadence(rentSchedule.map((item) => getRentSchedulePeriodKey(item)));
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
  rentSchedule: readonly Pick<IPropertyLongStayRentMonth, "month" | "periodKey">[],
  referenceDate: string
): string {
  return resolveAsOfPeriodKey(
    referenceDate,
    rentSchedule.map((item) => getRentSchedulePeriodKey(item))
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
  const dueUnpaidMonths = unpaid.filter((item) =>
    isPeriodKeyOnOrBefore(getRentSchedulePeriodKey(item), asOfKey)
  );
  const upcomingMonths = unpaid.filter((item) =>
    isPeriodKeyAfter(getRentSchedulePeriodKey(item), asOfKey)
  );
  const totalRemaining = dueUnpaidMonths.reduce((sum, item) => sum + item.remainingRent, 0);

  return {
    dueUnpaidMonths,
    paidMonths,
    unpaidSummary: { count: dueUnpaidMonths.length, totalRemaining },
    upcomingMonths,
  };
}

export function getExpectedRentForSchedulePeriod(
  rentSchedule: readonly TLeaseRentSchedulePeriodAmount[],
  periodKey: string
): number | undefined {
  return rentSchedule.find((item) => getRentSchedulePeriodKey(item) === periodKey)?.expectedRent;
}

export function getRemainingRentForSchedulePeriod(
  rentSchedule: readonly TLeaseRentSchedulePeriodAmount[],
  periodKey: string
): number | undefined {
  return rentSchedule.find((item) => getRentSchedulePeriodKey(item) === periodKey)?.remainingRent;
}
