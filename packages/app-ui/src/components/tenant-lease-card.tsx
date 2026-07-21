import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { type TTenantMembershipRole, type TTenantMembershipStatus } from "@/packages/shared";

import { formatIsoDateDisplay } from "../lib/format-iso-date";
import {
  formatTenantMembershipRole,
  formatTenantMembershipStatus,
} from "../lib/tenant-membership-labels";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";

export interface ITenantLeaseCardProps {
  amountDueLabel?: string;
  footer?: ReactNode;
  leaseEndDate: string;
  leaseStartDate: string;
  propertyName: string;
  role: TTenantMembershipRole;
  status: TTenantMembershipStatus;
  tenantDisplayName?: string;
  to?: string;
  unitLabel: string;
}

export const TenantLeaseCard = memo(function TenantLeaseCard({
  amountDueLabel,
  footer,
  leaseEndDate,
  leaseStartDate,
  propertyName,
  role,
  status,
  tenantDisplayName,
  to,
  unitLabel,
}: ITenantLeaseCardProps) {
  const hasFooter = footer != null;
  const card = (
    <Card
      className={`rounded-xl border-border/80 bg-card/85 shadow-sm${to && !hasFooter ? " transition-colors hover:border-primary/40" : ""}`}
    >
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-xl font-semibold tracking-tight">
          {propertyName}
        </CardTitle>
        <CardDescription>
          {unitLabel} · {formatTenantMembershipRole(role)} · {formatTenantMembershipStatus(status)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {tenantDisplayName ? (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Tenant</span>
            <span className="font-medium text-foreground">{tenantDisplayName}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Lease term</span>
          <span className="text-foreground">
            {formatIsoDateDisplay(leaseStartDate)} – {formatIsoDateDisplay(leaseEndDate)}
          </span>
        </div>
        {amountDueLabel ? (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Amount due</span>
            <span className="font-medium text-foreground">{amountDueLabel}</span>
          </div>
        ) : null}
      </CardContent>
      {hasFooter ? <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center">{footer}</CardFooter> : null}
    </Card>
  );

  if (to && !hasFooter) {
    return (
      <Link className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={to}>
        {card}
      </Link>
    );
  }

  return card;
});
TenantLeaseCard.displayName = "TenantLeaseCard";
