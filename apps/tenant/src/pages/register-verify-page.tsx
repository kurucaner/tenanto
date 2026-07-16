import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AuthCardBody, AuthCardFooter, AuthPageShell } from "@/components/auth/auth-page-shell";
import { tenantAuthApi } from "@/lib/api-client";
import { type ITenantRegisterVerifyLocationState } from "@/lib/auth-location-state";
import { parseSafeReturnTo } from "@/lib/invite-return-url";
import {
  Button,
  getAuthApiErrorMessage,
  getOtpResendButtonLabel,
  Input,
  Label,
  maskEmail,
  type TVerifyOtpFormValues,
  useOtpResendCooldown,
  verifyOtpSchema,
} from "@/packages/app-ui";
import { OTP_EXPIRY_MINUTES } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export const RegisterVerifyPage = memo(function RegisterVerifyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const state = location.state as ITenantRegisterVerifyLocationState | null;
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
  const returnTo = parseSafeReturnTo(state?.returnTo ?? null);

  const handleResend = useCallback(async () => {
    if (!canResend || resending || !email) {
      return;
    }

    setResending(true);
    try {
      await tenantAuthApi.registerStart({ email });
      toast.success("A new verification code was sent");
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
      const session = await tenantAuthApi.registerVerify({
        email,
        name,
        otp: values.otp,
        password,
      });
      setSession(session);
      toast.success("Account created");
      navigate(returnTo ?? "/home", { replace: true });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Verification failed"));
    } finally {
      setSubmitting(false);
    }
  });

  if (!state?.email || !state.name || !state.password) {
    return <Navigate replace to="/register" />;
  }

  return (
    <AuthPageShell
      cardDescription={`We sent a code to ${maskEmail(email)}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`}
      cardTitle="Verify email"
      onSubmit={onSubmit}
      redirectWhenAuthed={returnTo ?? "/home"}
      subtitle="Confirm your email to finish creating your account."
    >
      <AuthCardBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tenant-register-otp">Verification code</Label>
          <Input
            autoComplete="one-time-code"
            id="tenant-register-otp"
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
          onClick={() => void handleResend()}
          type="button"
          variant="outline"
        >
          {getOtpResendButtonLabel(resending, canResend, secondsRemaining)}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link className="font-medium text-primary hover:underline" to="/register">
            Use a different email
          </Link>
        </p>
      </AuthCardFooter>
    </AuthPageShell>
  );
});
RegisterVerifyPage.displayName = "RegisterVerifyPage";
