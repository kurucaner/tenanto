import {
  type IPropertyStripeConnectStatusResponse,
  PropertyStripeAccountType,
  type TPropertyStripeAccountType,
} from "@/packages/shared";

export type TStripeConnectUiStatus = "not_connected" | "ready" | "setup_incomplete";

export const EXPRESS_CONNECT_HELPER =
  "Use this if you don't have Stripe yet. Stripe will guide you through a quick setup.";

export const STANDARD_CONNECT_HELPER =
  "Use this if you already manage a Stripe account and want rent paid into it.";

export const STANDARD_STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com";

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

export function showDualConnectOptions(status: IPropertyStripeConnectStatusResponse): boolean {
  return getStripeConnectUiStatus(status) === "not_connected" && status.standardOAuthEnabled;
}

/** Express Account Links onboarding — hidden for Standard-connected properties. */
export function shouldShowExpressOnboardingButton(
  status: IPropertyStripeConnectStatusResponse
): boolean {
  if (!status.stripeAccountId) {
    return true;
  }
  return status.accountType === PropertyStripeAccountType.EXPRESS;
}

/** Standard OAuth — when disconnected (dual buttons) or finishing Standard setup. */
export function shouldShowStandardOAuthButton(
  status: IPropertyStripeConnectStatusResponse
): boolean {
  if (!status.standardOAuthEnabled) {
    return false;
  }
  if (!status.stripeAccountId) {
    return true;
  }
  return (
    status.accountType === PropertyStripeAccountType.STANDARD &&
    getStripeConnectUiStatus(status) === "setup_incomplete"
  );
}

export function shouldShowStandardDashboardLink(
  status: IPropertyStripeConnectStatusResponse
): boolean {
  return (
    status.accountType === PropertyStripeAccountType.STANDARD &&
    getStripeConnectUiStatus(status) === "ready"
  );
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

export function standardOAuthButtonLabel(uiStatus: TStripeConnectUiStatus): string {
  if (uiStatus === "setup_incomplete") {
    return "Finish connecting Stripe account";
  }
  return "Connect existing Stripe account";
}

export function stripeConnectSectionDescription(
  status: IPropertyStripeConnectStatusResponse,
  uiStatus: TStripeConnectUiStatus
): string {
  if (showDualConnectOptions(status)) {
    return "Connect Stripe so tenants can pay rent to this property.";
  }
  if (shouldShowStandardDashboardLink(status)) {
    return "Connected to your existing Stripe account. Tenants can pay rent to this property.";
  }
  switch (uiStatus) {
    case "ready":
      return "Tenants can pay rent to this property. Funds settle to the connected Stripe account after checkout.";
    case "setup_incomplete":
      return "Stripe Connect is started but not fully enabled for charges yet. Continue setup so tenants can pay rent.";
    case "not_connected":
    default:
      return `${EXPRESS_CONNECT_HELPER} Funds settle to the connected account after checkout.`;
  }
}
