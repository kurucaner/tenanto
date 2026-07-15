import { memo, type ReactNode } from "react";

import { getGoogleClientId } from "@/lib/google-auth-client-id";
import { GoogleOAuthProvider as GoogleOAuthProviderBase } from "@/packages/app-ui";

interface GoogleOAuthProviderProps {
  children: ReactNode;
}

export const GoogleOAuthProvider = memo(({ children }: GoogleOAuthProviderProps) => (
  <GoogleOAuthProviderBase clientId={getGoogleClientId()}>{children}</GoogleOAuthProviderBase>
));
GoogleOAuthProvider.displayName = "GoogleOAuthProvider";
