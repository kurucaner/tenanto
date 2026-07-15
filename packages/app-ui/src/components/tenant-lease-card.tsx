import { memo } from "react";
import { Link } from "react-router-dom";

import { type TTenantMembershipRole, type TTenantMembershipStatus } from "@/packages/shared";

import { formatIsoDateDisplay } from "../lib/format-iso-date";
import {
  formatTenantMembershipRole,
  formatTenantMembershipStatus,
} from "../lib/tenant-membership-labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export interface ITenantLeaseCardProps {
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
  leaseEndDate,
  leaseStartDate,
  propertyName,
  role,
  status,
  tenantDisplayName,
  to,
  unitLabel,
}: ITenantLeaseCardProps) {
  const card = (
    <Card
      className={`rounded-xl border-border/80 bg-card/85 shadow-sm${to ? " transition-colors hover:border-primary/40" : ""}`}
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
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={to}>
        {card}
      </Link>
    );
  }

  return card;
});
TenantLeaseCard.displayName = "TenantLeaseCard";
