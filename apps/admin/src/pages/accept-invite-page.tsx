import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { propertyInvitesApi } from "@/lib/api-client";
import {
  buildAuthHrefWithReturnTo,
  getAcceptInvitePath,
  parseSafeReturnTo,
} from "@/lib/invite-return-url";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  InvitePropertySummaryCard,
  ThemeSwitcher,
} from "@/packages/app-ui";
import { APP_NAME } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export const AcceptInvitePage = memo(function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = Boolean(accessToken && user);
  const token = searchParams.get("token")?.trim() ?? "";
  const returnTo = getAcceptInvitePath(token);

  const previewQuery = useQuery({
    enabled: token.length > 0,
    queryFn: () => propertyInvitesApi.previewInvite(token),
    queryKey: queryKeys.invitePreview(token),
  });

  const loginHref = buildAuthHrefWithReturnTo("/login", returnTo);
  const signupHref = previewQuery.data
    ? `${buildAuthHrefWithReturnTo("/signup", returnTo)}&email=${encodeURIComponent(previewQuery.data.inviteEmail)}`
    : buildAuthHrefWithReturnTo("/signup", returnTo);

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
              : "Confirm the details below, then sign in or create an account."}
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
              {!hydrated ? (
                <p className="text-sm text-muted-foreground">Checking session…</p>
              ) : isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You&apos;re signed in as {user?.email}. Return to your workspace to continue.
                  </p>
                  <Button asChild className="w-full" type="button">
                    <Link to={parseSafeReturnTo(returnTo) ?? "/home"}>Go to workspace</Link>
                  </Button>
                </div>
              ) : previewQuery.data.hasExistingAccount ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sign in with your existing account to continue with this invitation.
                  </p>
                  <Button asChild className="w-full" type="button">
                    <Link to={loginHref}>Sign in</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Create an account using {previewQuery.data.inviteEmail} to continue with this
                    invitation.
                  </p>
                  <Button asChild className="w-full" type="button">
                    <Link to={signupHref}>Create account</Link>
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
});
AcceptInvitePage.displayName = "AcceptInvitePage";
