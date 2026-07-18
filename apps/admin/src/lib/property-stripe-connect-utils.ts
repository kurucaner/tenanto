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

export const STANDARD_INCOMPLETE_HELPER =
  "Complete any remaining requirements in Stripe Dashboard, or reconnect your account below.";

export type TStripeConnectConnectedState =
  "express_incomplete" | "express_ready" | "standard_incomplete" | "standard_ready";

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

export function getStripeConnectConnectedState(
  status: IPropertyStripeConnectStatusResponse
): TStripeConnectConnectedState | null {
  const uiStatus = getStripeConnectUiStatus(status);
  if (uiStatus === "not_connected") {
    return null;
  }
  if (status.accountType === PropertyStripeAccountType.STANDARD) {
    return uiStatus === "ready" ? "standard_ready" : "standard_incomplete";
  }
  return uiStatus === "ready" ? "express_ready" : "express_incomplete";
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
  if (!status.standardOAuthEnabled) {
    return false;
  }
  const uiStatus = getStripeConnectUiStatus(status);
  return uiStatus === "not_connected" || uiStatus === "setup_incomplete";
}

export function isStripeConnectTypeSwitch(
  status: IPropertyStripeConnectStatusResponse,
  target: "express" | "standard"
): boolean {
  if (getStripeConnectUiStatus(status) !== "setup_incomplete") {
    return false;
  }
  if (target === "express") {
    return status.accountType === PropertyStripeAccountType.STANDARD;
  }
  return status.accountType === PropertyStripeAccountType.EXPRESS;
}

/** Express Account Links onboarding — hidden for ready Standard-connected properties. */
export function shouldShowExpressOnboardingButton(
  status: IPropertyStripeConnectStatusResponse
): boolean {
  if (!status.stripeAccountId) {
    return true;
  }
  if (
    status.accountType === PropertyStripeAccountType.STANDARD &&
    getStripeConnectUiStatus(status) === "setup_incomplete"
  ) {
    return true;
  }
  return status.accountType === PropertyStripeAccountType.EXPRESS;
}

/** Standard OAuth — when disconnected, finishing Standard setup, or switching from Express. */
export function shouldShowStandardOAuthButton(
  status: IPropertyStripeConnectStatusResponse
): boolean {
  if (
    status.stripeAccountId &&
    status.accountType === PropertyStripeAccountType.STANDARD &&
    getStripeConnectUiStatus(status) === "setup_incomplete"
  ) {
    return true;
  }
  if (
    status.stripeAccountId &&
    status.accountType === PropertyStripeAccountType.EXPRESS &&
    getStripeConnectUiStatus(status) === "setup_incomplete"
  ) {
    return status.standardOAuthEnabled;
  }
  if (!status.standardOAuthEnabled) {
    return false;
  }
  return !status.stripeAccountId;
}

export function shouldShowStandardDashboardLink(
  status: IPropertyStripeConnectStatusResponse
): boolean {
  return (
    status.accountType === PropertyStripeAccountType.STANDARD &&
    getStripeConnectUiStatus(status) === "ready"
  );
}

export function expressOnboardingButtonLabel(
  uiStatus: TStripeConnectUiStatus,
  accountType: TPropertyStripeAccountType | null = null
): string {
  if (uiStatus === "setup_incomplete" && accountType === PropertyStripeAccountType.STANDARD) {
    return "Set up new Stripe account";
  }
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

export function standardOAuthButtonLabel(
  uiStatus: TStripeConnectUiStatus,
  accountType: TPropertyStripeAccountType | null = null
): string {
  if (uiStatus === "setup_incomplete" && accountType === PropertyStripeAccountType.EXPRESS) {
    return "Connect existing Stripe account";
  }
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
    if (uiStatus === "setup_incomplete") {
      return "Setup isn't finished yet. Continue with your current option or connect a different way.";
    }
    return "Connect Stripe so tenants can pay rent to this property.";
  }
  if (shouldShowStandardDashboardLink(status)) {
    return "Connected to your existing Stripe account. Tenants can pay rent to this property.";
  }
  if (
    status.accountType === PropertyStripeAccountType.STANDARD &&
    uiStatus === "setup_incomplete"
  ) {
    return "Your Stripe account is linked but not fully enabled for charges yet. Finish connecting in Stripe to accept rent payments.";
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
