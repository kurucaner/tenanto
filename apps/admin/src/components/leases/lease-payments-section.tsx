import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format-money";
import { getActiveLeaseHoldoverScheduleNotice } from "@/lib/lease-proration-display";
import {
  formatRentSchedulePeriodLabel,
  getRentSchedulePeriodPluralLabel,
  getRentSchedulePeriodSingularLabel,
  hasOutstandingRent,
  inferRentScheduleCadenceFromItems,
  isRentMonthPartiallyPaid,
  partitionRentSchedule,
} from "@/lib/lease-rent-schedule-display";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  formatProratedDaysLabel,
  type IPropertyLongStay,
  type IPropertyLongStayRentMonth,
  isActiveLeaseInHoldover,
  PropertyLongStayStatus,
} from "@/packages/shared";

interface LeasePaymentsSectionProps {
  canManage: boolean;
  isPending: boolean;
  lease: IPropertyLongStay;
  onRecordRent: (month?: string) => void;
  rentSchedule: IPropertyLongStayRentMonth[];
}

interface UnpaidSummary {
  count: number;
  totalRemaining: number;
}

type TRentScheduleRowVariant = "due" | "paid" | "upcoming";

function getPaidPeriodsToggleLabel(
  showPaidPeriods: boolean,
  paidCount: number,
  periodLabel: string,
  periodPluralLabel: string
): string {
  if (showPaidPeriods) {
    return `Hide paid ${periodPluralLabel}`;
  }
  if (paidCount === 1) {
    return `Show 1 paid ${periodLabel}`;
  }
  return `Show ${paidCount} paid ${periodPluralLabel}`;
}

function getRentMonthAmountSubtitle(item: IPropertyLongStayRentMonth): string {
  if (item.paidRent > 0) {
    return `${formatMoney(item.paidRent)} / ${formatMoney(item.expectedRent)}`;
  }
  return formatMoney(item.expectedRent);
}

function RentScheduleRow({
  canRecord,
  item,
  onRecordRent,
  variant,
}: Readonly<{
  canRecord: boolean;
  item: IPropertyLongStayRentMonth;
  onRecordRent: (month: string) => void;
  variant: TRentScheduleRowVariant;
}>) {
  const showRecord = variant === "due" && canRecord && hasOutstandingRent(item);

  let action;
  if (variant === "paid") {
    action = <Badge variant="secondary">Paid</Badge>;
  } else if (variant === "upcoming") {
    action = <Badge variant="outline">Upcoming</Badge>;
  } else if (showRecord) {
    action = (
      <Button onClick={() => onRecordRent(item.month)} size="sm" type="button" variant="outline">
        Record
      </Button>
    );
  } else if (variant === "due") {
    action = <Badge variant="outline">Missing</Badge>;
  } else {
    action = null;
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        {variant === "paid" ? (
          <Check className="size-4 shrink-0 text-green-600" />
        ) : (
          <span className="inline-block size-4 shrink-0 rounded-full border" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm">{formatRentSchedulePeriodLabel(item.month)}</p>
            {item.isProrated ? (
              <Badge className="text-[10px]" variant="outline">
                Prorated
              </Badge>
            ) : null}
            {isRentMonthPartiallyPaid(item) ? (
              <Badge className="text-[10px]" variant="secondary">
                Partial
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">{getRentMonthAmountSubtitle(item)}</p>
          {item.isProrated ? (
            <p className="text-muted-foreground text-xs">
              {formatProratedDaysLabel(item.occupiedDays, item.daysInMonth)}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </li>
  );
}

function LeasePaymentsScheduleSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function LeasePaymentsSummary({
  periodPluralLabel,
  unpaidSummary,
  upcomingCount,
}: Readonly<{
  periodPluralLabel: string;
  upcomingCount: number;
  unpaidSummary: UnpaidSummary;
}>) {
  if (unpaidSummary.count > 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {unpaidSummary.count} unpaid · {formatMoney(unpaidSummary.totalRemaining)} remaining
      </p>
    );
  }

  if (upcomingCount > 0) {
    return (
      <p className="text-muted-foreground text-sm">
        All due {periodPluralLabel} are paid · {upcomingCount} upcoming
      </p>
    );
  }

  return <p className="text-muted-foreground text-sm">All rent {periodPluralLabel} are paid.</p>;
}

function UnpaidMonthsList({
  canRecord,
  dueUnpaidMonths,
  onRecordRent,
}: Readonly<{
  canRecord: boolean;
  dueUnpaidMonths: IPropertyLongStayRentMonth[];
  onRecordRent: (month: string) => void;
}>) {
  if (dueUnpaidMonths.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Unpaid</p>
      <ul className="divide-y rounded-md border">
        {dueUnpaidMonths.map((item) => (
          <RentScheduleRow
            canRecord={canRecord}
            item={item}
            key={item.month}
            onRecordRent={onRecordRent}
            variant="due"
          />
        ))}
      </ul>
    </div>
  );
}

function UpcomingMonthsList({
  upcomingMonths,
}: Readonly<{ upcomingMonths: IPropertyLongStayRentMonth[] }>) {
  if (upcomingMonths.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Upcoming</p>
      <ul className="divide-y rounded-md border">
        {upcomingMonths.map((item) => (
          <RentScheduleRow
            canRecord={false}
            item={item}
            key={item.month}
            onRecordRent={() => {}}
            variant="upcoming"
          />
        ))}
      </ul>
    </div>
  );
}

const PaidMonthsSection = memo(
  ({
    canRecord,
    onRecordRent,
    paidMonths,
    periodLabel,
    periodPluralLabel,
  }: Readonly<{
    canRecord: boolean;
    onRecordRent: (month: string) => void;
    paidMonths: IPropertyLongStayRentMonth[];
    periodLabel: string;
    periodPluralLabel: string;
  }>) => {
    const [showPaidMonths, setShowPaidMonths] = useState(false);

    if (paidMonths.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <Button
          className="gap-1.5"
          onClick={() => setShowPaidMonths((current) => !current)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {showPaidMonths ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          {getPaidPeriodsToggleLabel(
            showPaidMonths,
            paidMonths.length,
            periodLabel,
            periodPluralLabel
          )}
        </Button>
        {showPaidMonths ? (
          <ul className="divide-y rounded-md border">
            {paidMonths.map((item) => (
              <RentScheduleRow
                canRecord={canRecord}
                item={item}
                key={item.month}
                onRecordRent={onRecordRent}
                variant="paid"
              />
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
);
PaidMonthsSection.displayName = "PaidMonthsSection";

function LeasePaymentsScheduleContent({
  canRecord,
  dueUnpaidMonths,
  onRecordRent,
  paidMonths,
  periodLabel,
  periodPluralLabel,
  unpaidSummary,
  upcomingMonths,
}: Readonly<{
  canRecord: boolean;
  dueUnpaidMonths: IPropertyLongStayRentMonth[];
  onRecordRent: (month: string) => void;
  paidMonths: IPropertyLongStayRentMonth[];
  periodLabel: string;
  periodPluralLabel: string;
  upcomingMonths: IPropertyLongStayRentMonth[];
  unpaidSummary: UnpaidSummary;
}>) {
  return (
    <>
      <LeasePaymentsSummary
        periodPluralLabel={periodPluralLabel}
        upcomingCount={upcomingMonths.length}
        unpaidSummary={unpaidSummary}
      />
      <UnpaidMonthsList
        canRecord={canRecord}
        dueUnpaidMonths={dueUnpaidMonths}
        onRecordRent={onRecordRent}
      />
      <UpcomingMonthsList upcomingMonths={upcomingMonths} />
      <PaidMonthsSection
        canRecord={canRecord}
        onRecordRent={onRecordRent}
        paidMonths={paidMonths}
        periodLabel={periodLabel}
        periodPluralLabel={periodPluralLabel}
      />
    </>
  );
}

function renderScheduleContent({
  canRecord,
  dueUnpaidMonths,
  isPending,
  onRecordRent,
  paidMonths,
  periodLabel,
  periodPluralLabel,
  rentSchedule,
  unpaidSummary,
  upcomingMonths,
}: Readonly<{
  canRecord: boolean;
  dueUnpaidMonths: IPropertyLongStayRentMonth[];
  isPending: boolean;
  onRecordRent: (month: string) => void;
  paidMonths: IPropertyLongStayRentMonth[];
  periodLabel: string;
  periodPluralLabel: string;
  rentSchedule: IPropertyLongStayRentMonth[];
  upcomingMonths: IPropertyLongStayRentMonth[];
  unpaidSummary: UnpaidSummary;
}>) {
  if (isPending) {
    return <LeasePaymentsScheduleSkeleton />;
  }

  if (rentSchedule.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No rent {periodPluralLabel} in this lease.</p>
    );
  }

  return (
    <LeasePaymentsScheduleContent
      canRecord={canRecord}
      dueUnpaidMonths={dueUnpaidMonths}
      onRecordRent={onRecordRent}
      paidMonths={paidMonths}
      periodLabel={periodLabel}
      periodPluralLabel={periodPluralLabel}
      upcomingMonths={upcomingMonths}
      unpaidSummary={unpaidSummary}
    />
  );
}

export const LeasePaymentsSection = memo(
  ({ canManage, isPending, lease, onRecordRent, rentSchedule }: LeasePaymentsSectionProps) => {
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;
    const canRecord = canManage && isActive;
    const isInHoldover = isActiveLeaseInHoldover(lease, getTodayLocalIsoDate());
    const today = getTodayLocalIsoDate();
    const scheduleCadence = inferRentScheduleCadenceFromItems(rentSchedule);
    const periodLabel = getRentSchedulePeriodSingularLabel(scheduleCadence);
    const periodPluralLabel = getRentSchedulePeriodPluralLabel(scheduleCadence);
    const { dueUnpaidMonths, paidMonths, unpaidSummary, upcomingMonths } = useMemo(
      () => partitionRentSchedule(rentSchedule, today),
      [rentSchedule, today]
    );

    return (
      <Card>
        <CardContent className="space-y-4">
          {isInHoldover ? (
            <p className="text-muted-foreground text-sm">
              {getActiveLeaseHoldoverScheduleNotice()}
            </p>
          ) : null}
          {renderScheduleContent({
            canRecord,
            dueUnpaidMonths,
            isPending,
            onRecordRent,
            paidMonths,
            periodLabel,
            periodPluralLabel,
            rentSchedule,
            unpaidSummary,
            upcomingMonths,
          })}
        </CardContent>
      </Card>
    );
  }
);
LeasePaymentsSection.displayName = "LeasePaymentsSection";
