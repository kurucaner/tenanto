import {
  type IPropertyStripeConnectStatusResponse,
  PropertyStripeAccountType,
  type TPropertyStripeAccountType,
} from "@/packages/shared";

export type TStripeConnectUiStatus = "not_connected" | "ready" | "setup_incomplete";

export const EXPRESS_CONNECT_HELPER = "We’ll open Stripe and walk you through a quick setup.";

export const STANDARD_CONNECT_HELPER =
  "Link the Stripe account you already use for business banking.";

export const STANDARD_STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com";

export const STANDARD_INCOMPLETE_HELPER =
  "Complete any remaining requirements in Stripe Dashboard, or reconnect your account below.";

export const STRIPE_CONNECT_RETURN_HINT = "You’ll return here when you’re done.";

export const STANDARD_OAUTH_UNAVAILABLE_NOTE =
  "Linking an existing Stripe account isn’t available in this environment.";

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

export function getStripeConnectUiStatusBadgeLabel(uiStatus: TStripeConnectUiStatus): string {
  switch (uiStatus) {
    case "ready":
      return "Live";
    case "setup_incomplete":
      return "Finish setup";
    case "not_connected":
    default:
      return "Not set up";
  }
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
      return "Set up with Stripe";
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
  return "Connect existing account";
}

export function stripeConnectSectionDescription(
  status: IPropertyStripeConnectStatusResponse,
  uiStatus: TStripeConnectUiStatus
): string {
  if (uiStatus === "not_connected") {
    return "Let tenants pay rent online — money goes to your Stripe account.";
  }
  if (uiStatus === "ready") {
    return "Rent payments are live. Tenants can pay from their portal.";
  }
  if (showDualConnectOptions(status) || status.standardOAuthEnabled) {
    return "You’re almost ready. Finish setup, or switch to a different connection method.";
  }
  return "You’re almost ready. Finish Stripe setup so tenants can pay rent.";
}
