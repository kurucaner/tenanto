import { type VariantProps } from "class-variance-authority";
import { memo } from "react";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import {
  getStripeConnectAccountTypeLabel,
  getStripeConnectUiStatus,
  getStripeConnectUiStatusBadgeLabel,
  type TStripeConnectUiStatus,
} from "@/lib/property-stripe-connect-utils";
import type { IPropertyStripeConnectStatusResponse } from "@/packages/shared";

type TBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function getBadgeVariant(uiStatus: TStripeConnectUiStatus): TBadgeVariant {
  switch (uiStatus) {
    case "ready":
      return "secondary";
    case "setup_incomplete":
      return "default";
    case "not_connected":
    default:
      return "outline";
  }
}

export const PropertyStripeConnectStatusBadge = memo(function PropertyStripeConnectStatusBadge({
  status,
}: {
  status: IPropertyStripeConnectStatusResponse;
}) {
  const uiStatus = getStripeConnectUiStatus(status);
  const accountTypeLabel = getStripeConnectAccountTypeLabel(status.accountType);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={getBadgeVariant(uiStatus)}>
        {getStripeConnectUiStatusBadgeLabel(uiStatus)}
      </Badge>
      {accountTypeLabel ? <Badge variant="outline">{accountTypeLabel}</Badge> : null}
    </div>
  );
});
PropertyStripeConnectStatusBadge.displayName = "PropertyStripeConnectStatusBadge";
