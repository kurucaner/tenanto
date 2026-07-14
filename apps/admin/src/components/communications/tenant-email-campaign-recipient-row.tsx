import { type VariantProps } from "class-variance-authority";
import { memo } from "react";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  type ITenantEmailCampaignRecipient,
  TenantEmailRecipientStatus,
  type TTenantEmailRecipientStatus,
} from "@/packages/shared";

type TRecipientStatusBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function getRecipientStatusBadgeVariant(
  status: TTenantEmailRecipientStatus
): TRecipientStatusBadgeVariant {
  if (status === TenantEmailRecipientStatus.FAILED) {
    return "destructive";
  }
  if (status === TenantEmailRecipientStatus.SENT) {
    return "secondary";
  }
  return "outline";
}

export const TenantEmailCampaignRecipientRow = memo(
  ({ recipient }: { recipient: ITenantEmailCampaignRecipient }) => (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <p className="font-medium">{recipient.tenantName}</p>
          <p className="text-muted-foreground text-xs capitalize">{recipient.tenantRole}</p>
        </div>
      </TableCell>
      <TableCell className="text-sm">{recipient.email || "—"}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge variant={getRecipientStatusBadgeVariant(recipient.status)}>
            {recipient.status}
          </Badge>
          {recipient.lastError ? (
            <p className="text-destructive text-xs">{recipient.lastError}</p>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
);
TenantEmailCampaignRecipientRow.displayName = "TenantEmailCampaignRecipientRow";
