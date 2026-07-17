import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format-money";
import { formatLeaseMonthLabel } from "@/lib/lease-month-label";
import { getActiveLeaseHoldoverScheduleNotice } from "@/lib/lease-proration-display";
import {
  hasOutstandingRent,
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
  transactionDateToMonth,
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

function getPaidMonthsToggleLabel(showPaidMonths: boolean, paidCount: number): string {
  if (showPaidMonths) {
    return "Hide paid months";
  }
  if (paidCount === 1) {
    return "Show 1 paid month";
  }
  return `Show ${paidCount} paid months`;
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
            <p className="text-sm">{formatLeaseMonthLabel(item.month)}</p>
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
  unpaidSummary,
  upcomingCount,
}: Readonly<{ upcomingCount: number; unpaidSummary: UnpaidSummary }>) {
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
        All due months are paid · {upcomingCount} upcoming
      </p>
    );
  }

  return <p className="text-muted-foreground text-sm">All rent months are paid.</p>;
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
  }: Readonly<{
    canRecord: boolean;
    onRecordRent: (month: string) => void;
    paidMonths: IPropertyLongStayRentMonth[];
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
          {getPaidMonthsToggleLabel(showPaidMonths, paidMonths.length)}
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
  unpaidSummary,
  upcomingMonths,
}: Readonly<{
  canRecord: boolean;
  dueUnpaidMonths: IPropertyLongStayRentMonth[];
  onRecordRent: (month: string) => void;
  paidMonths: IPropertyLongStayRentMonth[];
  upcomingMonths: IPropertyLongStayRentMonth[];
  unpaidSummary: UnpaidSummary;
}>) {
  return (
    <>
      <LeasePaymentsSummary upcomingCount={upcomingMonths.length} unpaidSummary={unpaidSummary} />
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
  rentSchedule,
  unpaidSummary,
  upcomingMonths,
}: Readonly<{
  canRecord: boolean;
  dueUnpaidMonths: IPropertyLongStayRentMonth[];
  isPending: boolean;
  onRecordRent: (month: string) => void;
  paidMonths: IPropertyLongStayRentMonth[];
  rentSchedule: IPropertyLongStayRentMonth[];
  upcomingMonths: IPropertyLongStayRentMonth[];
  unpaidSummary: UnpaidSummary;
}>) {
  if (isPending) {
    return <LeasePaymentsScheduleSkeleton />;
  }

  if (rentSchedule.length === 0) {
    return <p className="text-muted-foreground text-sm">No rent months in this lease.</p>;
  }

  return (
    <LeasePaymentsScheduleContent
      canRecord={canRecord}
      dueUnpaidMonths={dueUnpaidMonths}
      onRecordRent={onRecordRent}
      paidMonths={paidMonths}
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
    const asOfMonth = transactionDateToMonth(getTodayLocalIsoDate());
    const { dueUnpaidMonths, paidMonths, unpaidSummary, upcomingMonths } = useMemo(
      () => partitionRentSchedule(rentSchedule, asOfMonth),
      [asOfMonth, rentSchedule]
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
