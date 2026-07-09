import { type CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { authApi } from "@/lib/api-client";
import { getAuthApiErrorMessage } from "@/lib/auth-api-errors";
import { useAuthStore } from "@/stores/auth-store";

function getGoogleClientId(): string | undefined {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return clientId != null && clientId !== "" ? clientId : undefined;
}

export const GoogleSignInButton = memo(() => {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const clientId = getGoogleClientId();

  const handleSuccess = async (response: CredentialResponse) => {
    const idToken = response.credential;
    if (!idToken) {
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
      toast.error(getAuthApiErrorMessage(error, "Google sign-in failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleError = () => {
    toast.error("Google sign-in was cancelled");
  };

  if (!clientId) {
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
