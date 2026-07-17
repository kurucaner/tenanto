import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { propertyInvitesApi } from "@/lib/api-client";
import { getGoogleClientId } from "@/lib/google-auth-client-id";
import { buildAuthHrefWithReturnTo, getAcceptInvitePath } from "@/lib/invite-return-url";
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
  getAuthApiErrorMessage,
  GoogleSignInButton,
  Input,
  InvitePropertySummaryCard,
  Label,
  ThemeSwitcher,
} from "@/packages/app-ui";
import { APP_NAME } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const inviteSignupSchema = z.object({
  name: authNameSchema,
  password: authPasswordSchema,
});

type TInviteSignupFormValues = z.infer<typeof inviteSignupSchema>;

interface IAcceptInviteActionProps {
  acting: "accept" | "decline" | null;
  hasExistingAccount: boolean;
  hydrated: boolean;
  inviteEmail: string;
  inviteEmailMatchesUser: boolean;
  isAuthenticated: boolean;
  loginHref: string;
  onAccept: () => void;
  onDecline: () => void;
  onSignupSuccess: () => void;
  token: string;
  userEmail: string | undefined;
}

const AcceptInviteSignupForm = memo(function AcceptInviteSignupForm({
  inviteEmail,
  onSignupSuccess,
  token,
}: {
  inviteEmail: string;
  onSignupSuccess: () => void;
  token: string;
}) {
  const setSession = useAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const form = useForm<TInviteSignupFormValues>({
    defaultValues: { name: "", password: "" },
    resolver: zodResolver(inviteSignupSchema),
  });

  const applySession = useCallback(
    (response: Awaited<ReturnType<typeof propertyInvitesApi.registerWithInvite>>) => {
      if (!response.session) {
        throw new Error("Signup succeeded but no session was returned");
      }
      setSession({
        accessToken: response.session.accessToken,
        refreshToken: response.session.refreshToken,
        user: response.session.user,
      });
      toast.success("Account created and invitation accepted");
      onSignupSuccess();
    },
    [onSignupSuccess, setSession]
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const response = await propertyInvitesApi.registerWithInvite({
        name: values.name,
        password: values.password,
        token,
      });
      applySession(response);
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
            const response = await propertyInvitesApi.registerWithInviteGoogle({
              idToken,
              token,
            });
            applySession(response);
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
  acting,
  hasExistingAccount,
  hydrated,
  inviteEmail,
  inviteEmailMatchesUser,
  isAuthenticated,
  loginHref,
  onAccept,
  onDecline,
  onSignupSuccess,
  token,
  userEmail,
}: IAcceptInviteActionProps) {
  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Checking session…</p>;
  }

  if (isAuthenticated) {
    if (inviteEmailMatchesUser) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You&apos;re signed in as {userEmail}. Accept to join this property or decline the
            invitation.
          </p>
          <Button className="w-full" disabled={acting != null} onClick={onAccept} type="button">
            {acting === "accept" ? "Accepting…" : "Accept invitation"}
          </Button>
          <Button
            className="w-full"
            disabled={acting != null}
            onClick={onDecline}
            type="button"
            variant="outline"
          >
            {acting === "decline" ? "Declining…" : "Decline invitation"}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          This invitation was sent to {inviteEmail}, but you&apos;re signed in as {userEmail}. Sign
          out and use the invited email to continue.
        </p>
        <Button asChild className="w-full" type="button" variant="outline">
          <Link to={loginHref}>Switch account</Link>
        </Button>
      </div>
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
      token={token}
    />
  );
});
AcceptInviteAction.displayName = "AcceptInviteAction";

export const AcceptInvitePage = memo(function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = Boolean(accessToken && user);
  const token = searchParams.get("token")?.trim() ?? "";
  const returnTo = getAcceptInvitePath(token);
  const [acting, setActing] = useState<"accept" | "decline" | null>(null);

  const previewQuery = useQuery({
    enabled: token.length > 0,
    queryFn: () => propertyInvitesApi.previewInvite(token),
    queryKey: queryKeys.invitePreview(token),
  });

  const loginHref = buildAuthHrefWithReturnTo("/login", returnTo);

  const inviteEmailMatchesUser =
    previewQuery.data != null &&
    user?.email != null &&
    previewQuery.data.inviteEmail.trim().toLowerCase() === user.email.trim().toLowerCase();

  const finishAccepted = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["properties"] });
    navigate("/home", { replace: true });
  }, [navigate, queryClient]);

  const handleAccept = useCallback(async () => {
    if (!token) {
      return;
    }

    setActing("accept");
    try {
      await propertyInvitesApi.redeemInvite(token);
      toast.success("Invitation accepted");
      await finishAccepted();
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to accept invitation"));
    } finally {
      setActing(null);
    }
  }, [finishAccepted, token]);

  const handleDecline = useCallback(async () => {
    if (!previewQuery.data) {
      return;
    }

    setActing("decline");
    try {
      await propertyInvitesApi.declineInvite(previewQuery.data.inviteId);
      toast.success("Invitation declined");
      navigate("/home", { replace: true });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to decline invitation"));
    } finally {
      setActing(null);
    }
  }, [navigate, previewQuery.data]);

  const handleSignupSuccess = useCallback(() => {
    void finishAccepted();
  }, [finishAccepted]);

  return (
    <div className="app-surface relative flex min-h-svh flex-col items-center justify-center gap-10 p-6">
      <div className="absolute end-4 top-4 z-10">
        <ThemeSwitcher />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Property workspace
        </p>
        <p className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {APP_NAME}
        </p>
        <p className="text-sm text-muted-foreground">Review your property team invitation.</p>
      </div>

      <Card className="w-full max-w-md rounded-2xl border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">
            Property invitation
          </CardTitle>
          <CardDescription>
            {token.length === 0
              ? "This invitation link is missing a token."
              : "Confirm the details below to join this property."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {token.length === 0 ? (
            <Button asChild className="w-full" type="button" variant="outline">
              <Link to="/login">Go to sign in</Link>
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
              <InvitePropertySummaryCard {...previewQuery.data.summary} />
              <AcceptInviteAction
                acting={acting}
                hasExistingAccount={previewQuery.data.hasExistingAccount}
                hydrated={hydrated}
                inviteEmail={previewQuery.data.inviteEmail}
                inviteEmailMatchesUser={inviteEmailMatchesUser}
                isAuthenticated={isAuthenticated}
                loginHref={loginHref}
                onAccept={() => {
                  void handleAccept();
                }}
                onDecline={() => {
                  void handleDecline();
                }}
                onSignupSuccess={handleSignupSuccess}
                token={token}
                userEmail={user?.email}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
});
AcceptInvitePage.displayName = "AcceptInvitePage";
