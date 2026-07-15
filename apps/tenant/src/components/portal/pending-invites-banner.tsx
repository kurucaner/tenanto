import { memo } from "react";
import { Link } from "react-router-dom";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/packages/app-ui";

interface IPendingInvitesBannerProps {
  pendingCount: number;
}

export const PendingInvitesBanner = memo(function PendingInvitesBanner({
  pendingCount,
}: IPendingInvitesBannerProps) {
  if (pendingCount <= 0) {
    return null;
  }

  const label =
    pendingCount === 1
      ? "You have 1 pending lease invitation."
      : `You have ${pendingCount} pending lease invitations.`;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">Pending invitations</CardTitle>
        <CardDescription>{label} Review and accept them to add leases to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild type="button">
          <Link to="/invites/pending">View pending invites</Link>
        </Button>
      </CardContent>
    </Card>
  );
});
PendingInvitesBanner.displayName = "PendingInvitesBanner";
