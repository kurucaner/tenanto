import type { IPropertyStripeConnectStatusResponse } from "@/packages/shared";

export type TStripeConnectUiStatus = "not_connected" | "ready" | "setup_incomplete";

export function getStripeConnectUiStatus(
  status: IPropertyStripeConnectStatusResponse
): TStripeConnectUiStatus {
  if (!status.stripeAccountId) {
    return "not_connected";
  }
  if (status.chargesEnabled) {
    return "ready";
  }
  return "setup_incomplete";
}
