import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AuthCardBody, AuthCardFooter, AuthPageShell } from "@/components/auth/auth-page-shell";
import { AuthProviderDivider } from "@/components/auth/auth-provider-divider";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api-client";
import { getAuthApiErrorMessage } from "@/lib/auth-api-errors";
import { signUpSchema, type TSignUpFormValues } from "@/lib/auth-form-schemas";
import { getWebAppUrl } from "@/lib/web-app-url";
import { AuthTermsNotice } from "@/packages/app-ui";

export const SignUpPage = memo(() => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TSignUpFormValues>({
    defaultValues: { email: "", name: "", password: "" },
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await authApi.register({
        email: values.email,
        name: values.name,
        password: values.password,
      });
      toast.success("Check your email for a verification code");
      navigate("/signup/verify", {
        replace: true,
        state: {
          email: values.email.trim(),
          name: values.name.trim(),
          password: values.password,
        },
      });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Sign-up failed"));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthPageShell
      cardDescription="Create your workspace account with email and password."
      cardTitle="Create account"
      onSubmit={onSubmit}
      subtitle="Create your workspace account."
    >
      <AuthCardBody>
        <GoogleSignInButton />
        <AuthProviderDivider />
        <div className="flex flex-col gap-2">
          <Label htmlFor="signup-name">Name</Label>
          <Input autoComplete="name" id="signup-name" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            autoComplete="email"
            id="signup-email"
            inputMode="email"
            type="email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            autoComplete="new-password"
            id="signup-password"
            type="password"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
      </AuthCardBody>
      <AuthCardFooter>
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Sending code…" : "Continue"}
        </Button>
        <AuthTermsNotice webAppUrl={getWebAppUrl()} />
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link className="text-primary font-medium hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </AuthCardFooter>
    </AuthPageShell>
  );
});
SignUpPage.displayName = "SignUpPage";
