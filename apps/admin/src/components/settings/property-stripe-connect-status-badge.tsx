import { type VariantProps } from "class-variance-authority";
import { memo } from "react";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import {
  getStripeConnectUiStatus,
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

function getBadgeLabel(uiStatus: TStripeConnectUiStatus): string {
  switch (uiStatus) {
    case "ready":
      return "Ready";
    case "setup_incomplete":
      return "Setup incomplete";
    case "not_connected":
    default:
      return "Not connected";
  }
}

export const PropertyStripeConnectStatusBadge = memo(function PropertyStripeConnectStatusBadge({
  status,
}: {
  status: IPropertyStripeConnectStatusResponse;
}) {
  const uiStatus = getStripeConnectUiStatus(status);
  return <Badge variant={getBadgeVariant(uiStatus)}>{getBadgeLabel(uiStatus)}</Badge>;
});
PropertyStripeConnectStatusBadge.displayName = "PropertyStripeConnectStatusBadge";
