export function stripeConnectAccountFlagsFromStripeAccount(account: {
  charges_enabled?: boolean | null;
  details_submitted?: boolean | null;
  payouts_enabled?: boolean | null;
}): {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
} {
  const chargesEnabled = Boolean(account.charges_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  return {
    chargesEnabled,
    detailsSubmitted,
    onboardingComplete: chargesEnabled && detailsSubmitted,
    payoutsEnabled,
  };
}
