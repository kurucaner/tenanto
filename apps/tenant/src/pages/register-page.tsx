import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AuthCardBody, AuthCardFooter, AuthPageShell } from "@/components/auth/auth-page-shell";
import { TenantGoogleSignInButton } from "@/components/auth/tenant-google-sign-in-button";
import { tenantAuthApi } from "@/lib/api-client";
import { parseSafeReturnTo } from "@/lib/invite-return-url";
import {
  AuthProviderDivider,
  Button,
  getAuthApiErrorMessage,
  Input,
  Label,
  signUpSchema,
  type TSignUpFormValues,
} from "@/packages/app-ui";

export const RegisterPage = memo(function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = parseSafeReturnTo(searchParams.get("returnTo"));
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TSignUpFormValues>({
    defaultValues: { email: "", name: "", password: "" },
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await tenantAuthApi.registerStart({ email: values.email });
      toast.success("Check your email for a verification code");
      navigate("/register/verify", {
        replace: true,
        state: {
          email: values.email.trim(),
          name: values.name.trim(),
          password: values.password,
          returnTo: returnTo ?? undefined,
        },
      });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Sign-up failed"));
    } finally {
      setSubmitting(false);
    }
  });

  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";

  return (
    <AuthPageShell
      cardDescription="Continue with Google, or create an account with email and password. Lease invites still require the invited email on your account."
      cardTitle="Create account"
      onSubmit={onSubmit}
      redirectWhenAuthed={returnTo ?? "/home"}
      subtitle="Create your resident portal account."
    >
      <AuthCardBody>
        <TenantGoogleSignInButton text="signup_with" />
        <AuthProviderDivider />
        <div className="flex flex-col gap-2">
          <Label htmlFor="tenant-register-name">Name</Label>
          <Input autoComplete="name" id="tenant-register-name" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tenant-register-email">Email</Label>
          <Input
            autoComplete="email"
            id="tenant-register-email"
            inputMode="email"
            type="email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tenant-register-password">Password</Label>
          <Input
            autoComplete="new-password"
            id="tenant-register-password"
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
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-medium text-primary hover:underline" to={loginHref}>
            Sign in
          </Link>
        </p>
      </AuthCardFooter>
    </AuthPageShell>
  );
});
RegisterPage.displayName = "RegisterPage";
