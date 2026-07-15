import { memo } from "react";

import { type TTenantMembershipRole } from "@/packages/shared";

import { formatIsoDateDisplay } from "../lib/format-iso-date";
import { formatTenantMembershipRole } from "../lib/tenant-membership-labels";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";

export interface ITenantPendingInviteCardProps {
  accepting?: boolean;
  declining?: boolean;
  displayName: string;
  expiresAt: string;
  membershipId: string;
  onAccept: (membershipId: string) => void;
  onDecline: (membershipId: string) => void;
  propertyName: string;
  role: TTenantMembershipRole;
  unitLabel: string;
}

export const TenantPendingInviteCard = memo(function TenantPendingInviteCard({
  accepting = false,
  declining = false,
  displayName,
  expiresAt,
  membershipId,
  onAccept,
  onDecline,
  propertyName,
  role,
  unitLabel,
}: ITenantPendingInviteCardProps) {
  const busy = accepting || declining;

  return (
    <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-xl font-semibold tracking-tight">
          {propertyName}
        </CardTitle>
        <CardDescription>
          {unitLabel} · {formatTenantMembershipRole(role)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Invited as</span>
          <span className="font-medium text-foreground">{displayName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Expires</span>
          <span className="text-foreground">{formatIsoDateDisplay(expiresAt.slice(0, 10))}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => onAccept(membershipId)} type="button">
          {accepting ? "Accepting…" : "Accept"}
        </Button>
        <Button
          disabled={busy}
          onClick={() => onDecline(membershipId)}
          type="button"
          variant="outline"
        >
          {declining ? "Declining…" : "Decline"}
        </Button>
      </CardFooter>
    </Card>
  );
});
TenantPendingInviteCard.displayName = "TenantPendingInviteCard";
