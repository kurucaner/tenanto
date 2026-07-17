import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  getPropertyMemberInviteRowState,
  type TPropertyMemberInviteStatusTone,
} from "@/lib/property-member-invite-display";
import { cn } from "@/lib/utils";
import { type IPropertyInvite } from "@/packages/shared";

const STATUS_BADGE_CLASS: Record<TPropertyMemberInviteStatusTone, string> = {
  muted: "border-muted-foreground/25 bg-muted text-muted-foreground",
  pending:
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
  warning:
    "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400",
};

export const PropertyMemberInviteStatusBadge = memo(({ invite }: { invite: IPropertyInvite }) => {
  const { statusLabel, statusTone } = getPropertyMemberInviteRowState(invite);

  return (
    <Badge className={cn("font-normal", STATUS_BADGE_CLASS[statusTone])} variant="outline">
      {statusLabel}
    </Badge>
  );
});
PropertyMemberInviteStatusBadge.displayName = "PropertyMemberInviteStatusBadge";
