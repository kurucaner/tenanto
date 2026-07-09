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
import { resetPasswordSchema, type TResetPasswordFormValues } from "@/lib/auth-form-schemas";
import { type IResetPasswordLocationState } from "@/lib/auth-location-state";
import { maskEmail } from "@/lib/mask-email";
import { getOtpResendButtonLabel } from "@/lib/otp-resend-button-label";
import { useAuthStore } from "@/stores/auth-store";

export const ResetPasswordPage = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const state = location.state as IResetPasswordLocationState | null;
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const { canResend, secondsRemaining, startCooldown } = useOtpResendCooldown();

  const form = useForm<TResetPasswordFormValues>({
    defaultValues: { confirmPassword: "", newPassword: "", otp: "" },
    resolver: zodResolver(resetPasswordSchema),
  });

  const email = state?.email ?? "";

  const handleResend = useCallback(async () => {
    if (!canResend || resending || !email) {
      return;
    }

    setResending(true);
    try {
      await authApi.forgotPassword(email);
      toast.success("A new reset code was sent");
      startCooldown();
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to resend code"));
      startCooldown();
    } finally {
      setResending(false);
    }
  }, [canResend, email, resending, startCooldown]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        email,
        newPassword: values.newPassword,
        otp: values.otp,
      });
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      toast.success("Password updated");
      navigate("/home", { replace: true });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Password reset failed"));
    } finally {
      setSubmitting(false);
    }
  });

  if (!state?.email) {
    return <Navigate replace to="/forgot-password" />;
  }

  return (
    <AuthPageShell
      cardDescription={`Enter the code sent to ${maskEmail(email)} and choose a new password.`}
      cardTitle="Reset password"
      onSubmit={onSubmit}
      subtitle="Choose a new password for your account."
    >
      <AuthCardBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-otp">Verification code</Label>
          <Input
            autoComplete="one-time-code"
            id="reset-otp"
            inputMode="numeric"
            maxLength={6}
            {...form.register("otp")}
          />
          {form.formState.errors.otp ? (
            <p className="text-xs text-destructive">{form.formState.errors.otp.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-new-password">New password</Label>
          <Input
            autoComplete="new-password"
            id="reset-new-password"
            type="password"
            {...form.register("newPassword")}
          />
          {form.formState.errors.newPassword ? (
            <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-confirm-password">Confirm password</Label>
          <Input
            autoComplete="new-password"
            id="reset-confirm-password"
            type="password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </div>
      </AuthCardBody>
      <AuthCardFooter>
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Updating…" : "Update password"}
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
          <Link className="text-primary font-medium hover:underline" to="/login">
            Back to sign in
          </Link>
        </p>
      </AuthCardFooter>
    </AuthPageShell>
  );
});
ResetPasswordPage.displayName = "ResetPasswordPage";
