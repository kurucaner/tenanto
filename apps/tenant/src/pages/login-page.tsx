import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AuthCardBody, AuthCardFooter, AuthPageShell } from "@/components/auth/auth-page-shell";
import { TenantGoogleSignInButton } from "@/components/auth/tenant-google-sign-in-button";
import { tenantAuthApi } from "@/lib/api-client";
import { parseSafeReturnTo } from "@/lib/invite-return-url";
import { getWebAppUrl } from "@/lib/web-app-url";
import {
  AuthProviderDivider,
  AuthTermsNotice,
  Button,
  getAuthApiErrorMessage,
  Input,
  Label,
  loginSchema,
  type TLoginFormValues,
} from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

export const LoginPage = memo(function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = parseSafeReturnTo(searchParams.get("returnTo"));
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TLoginFormValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const session = await tenantAuthApi.login({
        email: values.email,
        password: values.password,
      });
      setSession(session);
      toast.success("Signed in");
      navigate(returnTo ?? "/home", { replace: true });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Sign-in failed"));
    } finally {
      setSubmitting(false);
    }
  });

  const registerHref = returnTo
    ? `/register?returnTo=${encodeURIComponent(returnTo)}`
    : "/register";

  return (
    <AuthPageShell
      cardDescription="Use Google or your email and password. Lease invites still require the invited email on your account."
      cardTitle="Sign in"
      onSubmit={onSubmit}
      redirectWhenAuthed={returnTo ?? "/home"}
      subtitle="Sign in to your resident portal."
    >
      <AuthCardBody>
        <TenantGoogleSignInButton />
        <AuthProviderDivider />
        <div className="flex flex-col gap-2">
          <Label htmlFor="tenant-login-email">Email</Label>
          <Input
            autoComplete="email"
            id="tenant-login-email"
            inputMode="email"
            type="email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tenant-login-password">Password</Label>
          <Input
            autoComplete="current-password"
            id="tenant-login-password"
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
        <AuthTermsNotice webAppUrl={getWebAppUrl()} />
        <p className="text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link className="font-medium text-primary hover:underline" to={registerHref}>
            Create an account
          </Link>
        </p>
      </AuthCardFooter>
    </AuthPageShell>
  );
});
LoginPage.displayName = "LoginPage";
