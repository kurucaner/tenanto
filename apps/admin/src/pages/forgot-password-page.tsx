import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AuthCardBody, AuthCardFooter, AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api-client";
import { getAuthApiErrorCode, getAuthApiErrorMessage } from "@/lib/auth-api-errors";
import { forgotPasswordSchema, type TForgotPasswordFormValues } from "@/lib/auth-form-schemas";

export const ForgotPasswordPage = memo(() => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [socialAccountMessage, setSocialAccountMessage] = useState<string | null>(null);

  const form = useForm<TForgotPasswordFormValues>({
    defaultValues: { email: "" },
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setSocialAccountMessage(null);
    try {
      await authApi.forgotPassword(values.email);
      toast.success("If an account exists, you will receive an email");
      navigate("/reset-password", {
        replace: true,
        state: { email: values.email.trim() },
      });
    } catch (error) {
      if (getAuthApiErrorCode(error) === "SOCIAL_ACCOUNT") {
        setSocialAccountMessage(getAuthApiErrorMessage(error, "Use your social sign-in provider."));
        return;
      }
      toast.error(getAuthApiErrorMessage(error, "Failed to send reset code"));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthPageShell
      cardDescription="Enter your email and we will send a reset code if an account exists."
      cardTitle="Forgot password"
      onSubmit={onSubmit}
      subtitle="Reset your workspace password."
    >
      <AuthCardBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            autoComplete="email"
            id="forgot-email"
            inputMode="email"
            type="email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        {socialAccountMessage ? (
          <p className="text-sm text-destructive">{socialAccountMessage}</p>
        ) : null}
      </AuthCardBody>
      <AuthCardFooter>
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Sending code…" : "Send reset code"}
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
ForgotPasswordPage.displayName = "ForgotPasswordPage";
