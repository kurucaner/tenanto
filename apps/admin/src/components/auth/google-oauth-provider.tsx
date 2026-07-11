import { GoogleOAuthProvider as GoogleOAuthProviderBase } from "@react-oauth/google";
import { memo, type ReactNode } from "react";

import { getGoogleClientId } from "@/lib/google-auth-client-id";

interface GoogleOAuthProviderProps {
  children: ReactNode;
}

export const GoogleOAuthProvider = memo(({ children }: GoogleOAuthProviderProps) => {
  const clientId = getGoogleClientId();
  if (!clientId) {
    return children;
  }

  return <GoogleOAuthProviderBase clientId={clientId}>{children}</GoogleOAuthProviderBase>;
});
GoogleOAuthProvider.displayName = "GoogleOAuthProvider";
