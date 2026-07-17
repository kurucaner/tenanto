import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { authApi } from "@/lib/api-client";
import { getAuthApiErrorMessage } from "@/lib/auth-api-errors";
import { getGoogleClientId } from "@/lib/google-auth-client-id";
import { GoogleSignInButton as GoogleSignInButtonBase } from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

export const GoogleSignInButton = memo(({ returnTo }: { returnTo?: string | null }) => {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <GoogleSignInButtonBase
      clientId={getGoogleClientId()}
      onCredential={async (idToken) => {
        if (busy) return;
        setBusy(true);
        try {
          const res = await authApi.loginGoogle(idToken);
          setSession({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user,
          });
          toast.success("Signed in");
          navigate(returnTo ?? "/home", { replace: true });
        } catch (error) {
          toast.error(getAuthApiErrorMessage(error, "Google sign-in failed"));
        } finally {
          setBusy(false);
        }
      }}
      onError={() => {
        toast.error("Google sign-in was cancelled");
      }}
    />
  );
});
GoogleSignInButton.displayName = "GoogleSignInButton";
