import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { tenantPortalApi } from "@/lib/api-client";
import { getGoogleClientId } from "@/lib/google-auth-client-id";
import { invalidateTenantPortalCaches } from "@/lib/invalidate-tenant-portal-caches";
import { getAcceptInvitePath } from "@/lib/invite-return-url";
import { queryKeys } from "@/lib/query-keys";
import {
  authNameSchema,
  authPasswordSchema,
  AuthProviderDivider,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DarkPaletteMenu,
  getAuthApiErrorMessage,
  GoogleSignInButton,
  Input,
  InviteLeaseSummaryCard,
  Label,
  ThemeSwitcher,
  useResolvedDark,
} from "@/packages/app-ui";
import { APP_NAME } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const inviteSignupSchema = z.object({
  name: authNameSchema,
  password: authPasswordSchema,
});

type TInviteSignupFormValues = z.infer<typeof inviteSignupSchema>;

interface IAcceptInviteActionProps {
  accepting: boolean;
  hasExistingAccount: boolean;
  hydrated: boolean;
  inviteEmail: string;
  isAuthenticated: boolean;
  loginHref: string;
  onAccept: () => void;
  onSignupSuccess: () => void;
  summaryDisplayName: string;
  token: string;
}

const AcceptInviteSignupForm = memo(function AcceptInviteSignupForm({
  inviteEmail,
  onSignupSuccess,
  summaryDisplayName,
  token,
}: {
  inviteEmail: string;
  onSignupSuccess: () => void;
  summaryDisplayName: string;
  token: string;
}) {
  const setSession = useAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const form = useForm<TInviteSignupFormValues>({
    defaultValues: { name: summaryDisplayName, password: "" },
    resolver: zodResolver(inviteSignupSchema),
  });

  useEffect(() => {
    form.reset({ name: summaryDisplayName, password: "" });
  }, [form, summaryDisplayName]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const response = await tenantPortalApi.registerWithInvite({
        name: values.name,
        password: values.password,
        token,
      });
      if (!response.session) {
        throw new Error("Signup succeeded but no session was returned");
      }
      setSession(response.session);
      toast.success("Account created and invitation accepted");
      onSignupSuccess();
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to create account"));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">
        Create your account to accept this invitation. Your email is already verified via this
        invite link.
      </p>
      <GoogleSignInButton
        clientId={getGoogleClientId()}
        onCredential={async (idToken) => {
          if (googleBusy || submitting) {
            return;
          }
          setGoogleBusy(true);
          try {
            const response = await tenantPortalApi.registerWithInviteGoogle({
              idToken,
              token,
            });
            if (!response.session) {
              throw new Error("Signup succeeded but no session was returned");
            }
            setSession(response.session);
            toast.success("Account created and invitation accepted");
            onSignupSuccess();
          } catch (error) {
            toast.error(getAuthApiErrorMessage(error, "Google sign-up failed"));
          } finally {
            setGoogleBusy(false);
          }
        }}
        onError={() => {
          toast.error("Google sign-in was cancelled");
        }}
        text="signup_with"
      />
      <AuthProviderDivider />
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-signup-email">Email</Label>
        <Input
          autoComplete="email"
          id="invite-signup-email"
          readOnly
          type="email"
          value={inviteEmail}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-signup-name">Name</Label>
        <Input autoComplete="name" id="invite-signup-name" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-signup-password">Password</Label>
        <Input
          autoComplete="new-password"
          id="invite-signup-password"
          type="password"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
        ) : null}
      </div>
      <Button className="w-full" disabled={submitting || googleBusy} type="submit">
        {submitting ? "Creating account…" : "Create account and accept"}
      </Button>
    </form>
  );
});
AcceptInviteSignupForm.displayName = "AcceptInviteSignupForm";

const AcceptInviteAction = memo(function AcceptInviteAction({
  accepting,
  hasExistingAccount,
  hydrated,
  inviteEmail,
  isAuthenticated,
  loginHref,
  onAccept,
  onSignupSuccess,
  summaryDisplayName,
  token,
}: IAcceptInviteActionProps) {
  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Checking session…</p>;
  }

  if (isAuthenticated) {
    return (
      <Button className="w-full" disabled={accepting} onClick={onAccept} type="button">
        {accepting ? "Accepting…" : "Accept invitation"}
      </Button>
    );
  }

  if (hasExistingAccount) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign in with your existing account to accept this invitation.
        </p>
        <Button asChild className="w-full" type="button">
          <Link to={loginHref}>Sign in to accept</Link>
        </Button>
      </div>
    );
  }

  return (
    <AcceptInviteSignupForm
      inviteEmail={inviteEmail}
      onSignupSuccess={onSignupSuccess}
      summaryDisplayName={summaryDisplayName}
      token={token}
    />
  );
});
AcceptInviteAction.displayName = "AcceptInviteAction";

export const AcceptInvitePage = memo(function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resolvedDark = useResolvedDark();
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = Boolean(accessToken && user);
  const token = searchParams.get("token")?.trim() ?? "";
  const [accepting, setAccepting] = useState(false);

  const previewQuery = useQuery({
    enabled: token.length > 0,
    queryFn: () => tenantPortalApi.previewInvite(token),
    queryKey: queryKeys.invitePreview(token),
  });

  const returnTo = getAcceptInvitePath(token);
  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;

  const finishAccepted = async () => {
    await invalidateTenantPortalCaches(queryClient);
    navigate("/home", { replace: true });
  };

  const handleAccept = async () => {
    if (!token) {
      return;
    }

    setAccepting(true);
    try {
      await tenantPortalApi.redeemInviteAuthenticated(token);
      toast.success("Invitation accepted");
      await finishAccepted();
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to accept invitation"));
    } finally {
      setAccepting(false);
    }
  };

  const handleSignupSuccess = () => {
    void finishAccepted();
  };

  return (
    <div className="app-surface relative flex min-h-svh flex-col items-center justify-center gap-10 p-6">
      <div className="absolute end-4 top-4 z-10 flex items-center gap-2">
        {resolvedDark ? <DarkPaletteMenu /> : null}
        <ThemeSwitcher />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Resident portal
        </p>
        <p className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {APP_NAME}
        </p>
        <p className="text-sm text-muted-foreground">Review and accept your lease invitation.</p>
      </div>

      <Card className="w-full max-w-md rounded-2xl border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">
            Lease invitation
          </CardTitle>
          <CardDescription>
            {token.length === 0
              ? "This invitation link is missing a token."
              : "Confirm the details below to join this lease."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {token.length === 0 ? (
            <Button asChild className="w-full" type="button" variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          ) : null}

          {token.length > 0 && previewQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading invitation…</p>
          ) : null}

          {previewQuery.isError ? (
            <p className="text-sm text-destructive">
              {previewQuery.error instanceof Error
                ? previewQuery.error.message
                : "Invitation not found or expired"}
            </p>
          ) : null}

          {previewQuery.data ? (
            <>
              <InviteLeaseSummaryCard {...previewQuery.data.summary} />
              <AcceptInviteAction
                accepting={accepting}
                hasExistingAccount={previewQuery.data.hasExistingAccount}
                hydrated={hydrated}
                inviteEmail={previewQuery.data.inviteEmail}
                isAuthenticated={isAuthenticated}
                loginHref={loginHref}
                onAccept={() => {
                  void handleAccept();
                }}
                onSignupSuccess={handleSignupSuccess}
                summaryDisplayName={previewQuery.data.summary.displayName}
                token={token}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
});
AcceptInvitePage.displayName = "AcceptInvitePage";
