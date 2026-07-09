import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format-money";
import { formatLeaseMonthLabel } from "@/lib/lease-month-label";
import {
  type IPropertyLongStay,
  type IPropertyLongStayRentMonth,
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
  totalExpected: number;
}

function getPaidMonthsToggleLabel(showPaidMonths: boolean, paidCount: number): string {
  if (showPaidMonths) {
    return "Hide paid months";
  }
  if (paidCount === 1) {
    return "Show 1 paid month";
  }
  return `Show ${paidCount} paid months`;
}

function partitionRentSchedule(rentSchedule: IPropertyLongStayRentMonth[]) {
  const unpaidMonths = rentSchedule.filter((item) => !item.isPaid);
  const paidMonths = rentSchedule.filter((item) => item.isPaid);
  const totalExpected = unpaidMonths.reduce((sum, item) => sum + item.expectedRent, 0);
  return {
    paidMonths,
    unpaidMonths,
    unpaidSummary: { count: unpaidMonths.length, totalExpected },
  };
}

function RentScheduleRow({
  canRecord,
  item,
  onRecordRent,
}: Readonly<{
  canRecord: boolean;
  item: IPropertyLongStayRentMonth;
  onRecordRent: (month: string) => void;
}>) {
  let action;
  if (item.isPaid) {
    action = <Badge variant="secondary">Paid</Badge>;
  } else if (canRecord) {
    action = (
      <Button onClick={() => onRecordRent(item.month)} size="sm" type="button" variant="outline">
        Record
      </Button>
    );
  } else {
    action = <Badge variant="outline">Missing</Badge>;
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        {item.isPaid ? (
          <Check className="size-4 shrink-0 text-green-600" />
        ) : (
          <span className="inline-block size-4 shrink-0 rounded-full border" />
        )}
        <div className="min-w-0">
          <p className="text-sm">{formatLeaseMonthLabel(item.month)}</p>
          <p className="text-muted-foreground text-xs">{formatMoney(item.expectedRent)}</p>
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

function LeasePaymentsSummary({ unpaidSummary }: Readonly<{ unpaidSummary: UnpaidSummary }>) {
  if (unpaidSummary.count > 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {unpaidSummary.count} unpaid · {formatMoney(unpaidSummary.totalExpected)} expected
      </p>
    );
  }

  return <p className="text-muted-foreground text-sm">All rent months are paid.</p>;
}

function UnpaidMonthsList({
  canRecord,
  onRecordRent,
  unpaidMonths,
}: Readonly<{
  canRecord: boolean;
  onRecordRent: (month: string) => void;
  unpaidMonths: IPropertyLongStayRentMonth[];
}>) {
  if (unpaidMonths.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Unpaid</p>
      <ul className="divide-y rounded-md border">
        {unpaidMonths.map((item) => (
          <RentScheduleRow
            canRecord={canRecord}
            item={item}
            key={item.month}
            onRecordRent={onRecordRent}
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
  onRecordRent,
  paidMonths,
  unpaidMonths,
  unpaidSummary,
}: Readonly<{
  canRecord: boolean;
  onRecordRent: (month: string) => void;
  paidMonths: IPropertyLongStayRentMonth[];
  unpaidMonths: IPropertyLongStayRentMonth[];
  unpaidSummary: UnpaidSummary;
}>) {
  return (
    <>
      <LeasePaymentsSummary unpaidSummary={unpaidSummary} />
      <UnpaidMonthsList
        canRecord={canRecord}
        onRecordRent={onRecordRent}
        unpaidMonths={unpaidMonths}
      />
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
  isPending,
  onRecordRent,
  paidMonths,
  rentSchedule,
  unpaidMonths,
  unpaidSummary,
}: Readonly<{
  canRecord: boolean;
  isPending: boolean;
  onRecordRent: (month: string) => void;
  paidMonths: IPropertyLongStayRentMonth[];
  rentSchedule: IPropertyLongStayRentMonth[];
  unpaidMonths: IPropertyLongStayRentMonth[];
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
      onRecordRent={onRecordRent}
      paidMonths={paidMonths}
      unpaidMonths={unpaidMonths}
      unpaidSummary={unpaidSummary}
    />
  );
}

export const LeasePaymentsSection = memo(
  ({ canManage, isPending, lease, onRecordRent, rentSchedule }: LeasePaymentsSectionProps) => {
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;
    const canRecord = canManage && isActive;
    const { paidMonths, unpaidMonths, unpaidSummary } = useMemo(
      () => partitionRentSchedule(rentSchedule),
      [rentSchedule]
    );

    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          {renderScheduleContent({
            canRecord,
            isPending,
            onRecordRent,
            paidMonths,
            rentSchedule,
            unpaidMonths,
            unpaidSummary,
          })}
        </CardContent>
      </Card>
    );
  }
);
LeasePaymentsSection.displayName = "LeasePaymentsSection";
