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
import { loginSchema, type TLoginFormValues } from "@/lib/auth-form-schemas";
import { useAuthStore } from "@/stores/auth-store";

const LoginPageInner = memo(() => {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TLoginFormValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const res = await authApi.loginEmail(values.email.trim(), values.password);
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      toast.success("Signed in");
      navigate("/home", { replace: true });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Sign-in failed"));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthPageShell
      cardDescription="Use your email and password."
      cardTitle="Sign in"
      onSubmit={onSubmit}
      subtitle="Sign in to your workspace."
    >
      <AuthCardBody>
        <GoogleSignInButton />
        <AuthProviderDivider />
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-email">Email</Label>
          <Input
            autoComplete="email"
            id="admin-email"
            inputMode="email"
            type="email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="admin-password">Password</Label>
            <Link className="text-primary text-xs font-medium hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <Input
            autoComplete="current-password"
            id="admin-password"
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
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Need an account?{" "}
          <Link className="text-primary font-medium hover:underline" to="/signup">
            Create an account
          </Link>
        </p>
      </AuthCardFooter>
    </AuthPageShell>
  );
});
LoginPageInner.displayName = "LoginPageInner";

export const LoginPage = LoginPageInner;
