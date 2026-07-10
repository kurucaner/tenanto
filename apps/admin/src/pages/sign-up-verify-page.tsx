import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AuthCardBody, AuthCardFooter, AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";
import { authApi } from "@/lib/api-client";
import { getAuthApiErrorMessage } from "@/lib/auth-api-errors";
import { type TVerifyOtpFormValues, verifyOtpSchema } from "@/lib/auth-form-schemas";
import { type ISignUpVerifyLocationState } from "@/lib/auth-location-state";
import { maskEmail } from "@/lib/mask-email";
import { getOtpResendButtonLabel } from "@/lib/otp-resend-button-label";
import { useAuthStore } from "@/stores/auth-store";

export const SignUpVerifyPage = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const state = location.state as ISignUpVerifyLocationState | null;
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const { canResend, secondsRemaining, startCooldown } = useOtpResendCooldown();

  const form = useForm<TVerifyOtpFormValues>({
    defaultValues: { otp: "" },
    resolver: zodResolver(verifyOtpSchema),
  });

  const email = state?.email ?? "";
  const name = state?.name ?? "";
  const password = state?.password ?? "";

  const handleResend = useCallback(async () => {
    if (!canResend || resending || !email || !name || !password) {
      return;
    }

    setResending(true);
    try {
      await authApi.register({ email, name, password });
      toast.success("A new verification code was sent");
      startCooldown();
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to resend code"));
      startCooldown();
    } finally {
      setResending(false);
    }
  }, [canResend, email, name, password, resending, startCooldown]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const res = await authApi.registerVerify({
        email,
        name,
        otp: values.otp,
        password,
      });
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      toast.success("Account created");
      navigate("/home", { replace: true });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Verification failed"));
    } finally {
      setSubmitting(false);
    }
  });

  if (!state?.email || !state.name || !state.password) {
    return <Navigate replace to="/signup" />;
  }

  return (
    <AuthPageShell
      cardDescription={`We sent a code to ${maskEmail(email)}. It expires in 10 minutes.`}
      cardTitle="Verify email"
      onSubmit={onSubmit}
      subtitle="Confirm your email to finish creating your account."
    >
      <AuthCardBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="signup-otp">Verification code</Label>
          <Input
            autoComplete="one-time-code"
            id="signup-otp"
            inputMode="numeric"
            maxLength={6}
            {...form.register("otp")}
          />
          {form.formState.errors.otp ? (
            <p className="text-xs text-destructive">{form.formState.errors.otp.message}</p>
          ) : null}
        </div>
      </AuthCardBody>
      <AuthCardFooter>
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Verifying…" : "Verify and create account"}
        </Button>
        <Button
          className="w-full"
          disabled={!canResend || resending}
          onClick={handleResend}
          type="button"
          variant="outline"
        >
          {getOtpResendButtonLabel(resending, canResend, secondsRemaining)}
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          <Link className="text-primary font-medium hover:underline" to="/signup">
            Use a different email
          </Link>
        </p>
      </AuthCardFooter>
    </AuthPageShell>
  );
});
SignUpVerifyPage.displayName = "SignUpVerifyPage";
