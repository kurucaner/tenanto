import { type CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useResolvedAdminDark } from "@/hooks/use-resolved-admin-dark";
import { authApi } from "@/lib/api-client";
import { getAuthApiErrorMessage } from "@/lib/auth-api-errors";
import { getGoogleClientId } from "@/lib/google-auth-client-id";
import { useAuthStore } from "@/stores/auth-store";

export const GoogleSignInButton = memo(() => {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const resolvedDark = useResolvedAdminDark();
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
    <div
      aria-busy={submitting}
      className={`flex w-full justify-center ${submitting ? "pointer-events-none opacity-60" : ""}`}
    >
      <GoogleLogin
        containerProps={{
          className: "overflow-hidden leading-none",
        }}
        key={resolvedDark ? "dark" : "light"}
        logo_alignment="left"
        onError={handleError}
        onSuccess={handleSuccess}
        shape="pill"
        size="medium"
        text="signin_with"
        theme={resolvedDark ? "filled_black" : "outline"}
      />
    </div>
  );
});
GoogleSignInButton.displayName = "GoogleSignInButton";
