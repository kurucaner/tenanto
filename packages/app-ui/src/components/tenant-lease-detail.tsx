import { memo } from "react";

import { getLeaseRentAmount, type ITenantLeaseDetailResponse } from "@/packages/shared";

import { formatIsoDateDisplay } from "../lib/format-iso-date";
import {
  formatTenantMembershipRole,
  formatTenantMembershipStatus,
} from "../lib/tenant-membership-labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    style: "currency",
  }).format(amount);
}

export interface ITenantLeaseRentScheduleProps {
  lease: ITenantLeaseDetailResponse;
}

export const TenantLeaseRentSchedule = memo(function TenantLeaseRentSchedule({
  lease,
}: ITenantLeaseRentScheduleProps) {
  return (
    <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-semibold">Rent schedule</CardTitle>
        <CardDescription>
          Expected rent by period. Amounts are read-only; contact your property manager with
          questions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lease.rentSchedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rent periods on this lease yet.</p>
        ) : (
          <ul className="divide-y divide-border/80 rounded-lg border border-border/80">
            {lease.rentSchedule.map((item) => (
              <li
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                key={`${item.periodLabel}-${item.dueDate}`}
              >
                <div>
                  <p className="font-medium text-foreground">{item.periodLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatIsoDateDisplay(item.dueDate)}
                  </p>
                </div>
                <p className="font-medium text-foreground">{formatCurrency(item.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});
TenantLeaseRentSchedule.displayName = "TenantLeaseRentSchedule";

export interface ITenantLeaseDetailSummaryProps {
  lease: ITenantLeaseDetailResponse;
}

export const TenantLeaseDetailSummary = memo(function TenantLeaseDetailSummary({
  lease,
}: ITenantLeaseDetailSummaryProps) {
  return (
    <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-2xl font-semibold tracking-tight">
          {lease.propertyName}
        </CardTitle>
        <CardDescription>
          {lease.unitLabel} · {formatTenantMembershipRole(lease.role)} ·{" "}
          {formatTenantMembershipStatus(lease.status)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Tenant</span>
          <span className="font-medium text-foreground">{lease.displayName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Lease term</span>
          <span className="text-foreground">
            {formatIsoDateDisplay(lease.leaseStartDate)} – {formatIsoDateDisplay(lease.leaseEndDate)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Monthly rent</span>
          <span className="font-medium text-foreground">{formatCurrency(getLeaseRentAmount(lease))}</span>
        </div>
      </CardContent>
    </Card>
  );
});
TenantLeaseDetailSummary.displayName = "TenantLeaseDetailSummary";
