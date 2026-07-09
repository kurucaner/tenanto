import { GoogleOAuthProvider as GoogleOAuthProviderBase } from "@react-oauth/google";
import { memo, type ReactNode } from "react";

interface GoogleOAuthProviderProps {
  children: ReactNode;
}

function getGoogleClientId(): string | undefined {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return clientId != null && clientId !== "" ? clientId : undefined;
}

export const GoogleOAuthProvider = memo(({ children }: GoogleOAuthProviderProps) => {
  const clientId = getGoogleClientId();
  if (!clientId) {
    return children;
  }

  return <GoogleOAuthProviderBase clientId={clientId}>{children}</GoogleOAuthProviderBase>;
});
GoogleOAuthProvider.displayName = "GoogleOAuthProvider";
