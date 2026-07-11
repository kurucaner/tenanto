import { GoogleOAuthProvider as GoogleOAuthProviderBase } from "@react-oauth/google";
import { memo, type ReactNode } from "react";

import {
  getGoogleClientId,
  logGoogleAuth,
  warnGoogleAuth,
} from "@/lib/google-auth-client-id";

interface GoogleOAuthProviderProps {
  children: ReactNode;
}

export const GoogleOAuthProvider = memo(({ children }: GoogleOAuthProviderProps) => {
  const clientId = getGoogleClientId();

  logGoogleAuth("provider mount", {
    clientIdPrefix: clientId?.slice(0, 12),
    hasClientId: Boolean(clientId),
  });

  if (!clientId) {
    warnGoogleAuth("provider skipped — VITE_GOOGLE_CLIENT_ID missing at build time");
    return children;
  }

  return <GoogleOAuthProviderBase clientId={clientId}>{children}</GoogleOAuthProviderBase>;
});
GoogleOAuthProvider.displayName = "GoogleOAuthProvider";
