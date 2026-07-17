import { memo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { tenantAuthApi } from "@/lib/api-client";
import { getGoogleClientId } from "@/lib/google-auth-client-id";
import { parseSafeReturnTo } from "@/lib/invite-return-url";
import {
  getAuthApiErrorMessage,
  GoogleSignInButton as GoogleSignInButtonBase,
} from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

export interface ITenantGoogleSignInButtonProps {
  text?: "continue_with" | "signin_with" | "signup_with";
}

export const TenantGoogleSignInButton = memo(function TenantGoogleSignInButton({
  text = "signin_with",
}: ITenantGoogleSignInButtonProps) {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = parseSafeReturnTo(searchParams.get("returnTo"));
  const [busy, setBusy] = useState(false);

  return (
    <GoogleSignInButtonBase
      clientId={getGoogleClientId()}
      onCredential={async (idToken) => {
        if (busy) return;
        setBusy(true);
        try {
          const session = await tenantAuthApi.loginGoogle(idToken);
          setSession(session);
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
      text={text}
    />
  );
});
TenantGoogleSignInButton.displayName = "TenantGoogleSignInButton";
