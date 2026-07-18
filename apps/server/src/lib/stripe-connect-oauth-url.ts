const STRIPE_CONNECT_OAUTH_AUTHORIZE_URL = "https://connect.stripe.com/oauth/authorize";

export function buildStripeConnectStandardOAuthAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "read_write",
    state: input.state,
  });
  return `${STRIPE_CONNECT_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}
