import { GoogleOAuthProvider as GoogleOAuthProviderBase } from "@react-oauth/google";
import { memo, type ReactNode } from "react";

export interface IGoogleOAuthProviderProps {
  children: ReactNode;
  clientId: string | undefined;
}

export const GoogleOAuthProvider = memo(({ children, clientId }: IGoogleOAuthProviderProps) => {
  if (!clientId) {
    return children;
  }

  return <GoogleOAuthProviderBase clientId={clientId}>{children}</GoogleOAuthProviderBase>;
});
GoogleOAuthProvider.displayName = "GoogleOAuthProvider";
