import {
  type IPropertyStripeConnectStatusResponse,
  PropertyStripeAccountType,
  type TPropertyStripeAccountType,
} from "@/packages/shared";

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

export function getStripeConnectAccountTypeLabel(
  accountType: TPropertyStripeAccountType | null
): string | null {
  if (accountType === PropertyStripeAccountType.EXPRESS) {
    return "Express";
  }
  if (accountType === PropertyStripeAccountType.STANDARD) {
    return "Standard";
  }
  return null;
}

/** Express Account Links onboarding — not used for Standard-connected properties. */
export function shouldShowExpressOnboardingButton(
  status: IPropertyStripeConnectStatusResponse
): boolean {
  if (!status.stripeAccountId) {
    return true;
  }
  return status.accountType === PropertyStripeAccountType.EXPRESS;
}

export function expressOnboardingButtonLabel(uiStatus: TStripeConnectUiStatus): string {
  switch (uiStatus) {
    case "ready":
      return "Update Stripe details";
    case "setup_incomplete":
      return "Continue Stripe setup";
    case "not_connected":
    default:
      return "Set up new Stripe account";
  }
}

export function expressConnectDescription(uiStatus: TStripeConnectUiStatus): string {
  switch (uiStatus) {
    case "ready":
      return "Tenants can pay rent to this property. Funds settle to the connected Stripe account after checkout.";
    case "setup_incomplete":
      return "Stripe Connect is started but not fully enabled for charges yet. Continue setup so tenants can pay rent.";
    case "not_connected":
    default:
      return "Use this if you don't have Stripe yet. Stripe will guide you through a quick setup so tenants can pay rent to this property.";
  }
}

/** Gate for Phase 3b Standard OAuth button — hidden until backend enables Standard OAuth. */
export function shouldShowStandardOAuthButton(
  status: IPropertyStripeConnectStatusResponse
): boolean {
  return status.standardOAuthEnabled && !status.stripeAccountId;
}
