import { memo } from "react";

import { type TTenantMembershipRole } from "@/packages/shared";

import { formatIsoDateDisplay } from "../lib/format-iso-date";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export interface IInviteLeaseSummaryCardProps {
  displayName: string;
  leaseEndDate: string;
  leaseStartDate: string;
  propertyName: string;
  role: TTenantMembershipRole;
  unitLabel: string;
}

function formatRoleLabel(role: TTenantMembershipRole): string {
  return role === "primary" ? "Primary tenant" : "Secondary tenant";
}

export const InviteLeaseSummaryCard = memo(function InviteLeaseSummaryCard({
  displayName,
  leaseEndDate,
  leaseStartDate,
  propertyName,
  role,
  unitLabel,
}: IInviteLeaseSummaryCardProps) {
  return (
    <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-xl font-semibold tracking-tight">
          {propertyName}
        </CardTitle>
        <CardDescription>
          {unitLabel} · {formatRoleLabel(role)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Tenant</span>
          <span className="font-medium text-foreground">{displayName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Lease term</span>
          <span className="text-foreground">
            {formatIsoDateDisplay(leaseStartDate)} – {formatIsoDateDisplay(leaseEndDate)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});
InviteLeaseSummaryCard.displayName = "InviteLeaseSummaryCard";
