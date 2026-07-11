import { type CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { authApi } from "@/lib/api-client";
import { getAuthApiErrorMessage } from "@/lib/auth-api-errors";
import {
  errorGoogleAuth,
  getGoogleClientId,
  logGoogleAuth,
  warnGoogleAuth,
} from "@/lib/google-auth-client-id";
import { useAuthStore } from "@/stores/auth-store";

export const GoogleSignInButton = memo(() => {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const clientId = getGoogleClientId();

  logGoogleAuth("button render", {
    clientIdPrefix: clientId?.slice(0, 12),
    hasClientId: Boolean(clientId),
  });

  const handleSuccess = async (response: CredentialResponse) => {
    logGoogleAuth("GoogleLogin onSuccess", {
      hasCredential: Boolean(response.credential),
    });

    const idToken = response.credential;
    if (!idToken) {
      warnGoogleAuth("GoogleLogin succeeded but credential was empty");
      toast.error("Google sign-in failed");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.loginGoogle(idToken);
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      toast.success("Signed in");
      navigate("/home", { replace: true });
    } catch (error) {
      errorGoogleAuth("backend login failed", { error });
      toast.error(getAuthApiErrorMessage(error, "Google sign-in failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleError = () => {
    errorGoogleAuth("GoogleLogin onError");
    toast.error("Google sign-in was cancelled");
  };

  if (!clientId) {
    warnGoogleAuth("button hidden — no client id");
    return null;
  }

  return (
    <div aria-busy={submitting} className={submitting ? "pointer-events-none opacity-60" : ""}>
      <GoogleLogin
        onError={handleError}
        onSuccess={handleSuccess}
        size="large"
        text="continue_with"
        theme="outline"
      />
    </div>
  );
});
GoogleSignInButton.displayName = "GoogleSignInButton";
