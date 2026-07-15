import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { tenantPortalApi } from "@/lib/api-client";
import { invalidateTenantPortalCaches } from "@/lib/invalidate-tenant-portal-caches";
import { getAcceptInvitePath } from "@/lib/invite-return-url";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DarkPaletteMenu,
  getAuthApiErrorMessage,
  InviteLeaseSummaryCard,
  ThemeSwitcher,
  useResolvedDark,
} from "@/packages/app-ui";
import { APP_NAME } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

interface IAcceptInviteActionProps {
  accepting: boolean;
  hasExistingAccount: boolean;
  hydrated: boolean;
  isAuthenticated: boolean;
  loginHref: string;
  onAccept: () => void;
  registerHref: string;
}

const AcceptInviteAction = memo(function AcceptInviteAction({
  accepting,
  hasExistingAccount,
  hydrated,
  isAuthenticated,
  loginHref,
  onAccept,
  registerHref,
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Create an account to accept this invitation.</p>
      <Button asChild className="w-full" type="button">
        <Link to={registerHref}>Create account</Link>
      </Button>
      <Button asChild className="w-full" type="button" variant="outline">
        <Link to={loginHref}>Already have an account? Sign in</Link>
      </Button>
    </div>
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
  const registerHref = `/register?returnTo=${encodeURIComponent(returnTo)}`;

  const handleAccept = async () => {
    if (!token) {
      return;
    }

    setAccepting(true);
    try {
      await tenantPortalApi.redeemInviteAuthenticated(token);
      await invalidateTenantPortalCaches(queryClient);
      toast.success("Invitation accepted");
      navigate("/leases", { replace: true });
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to accept invitation"));
    } finally {
      setAccepting(false);
    }
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
                isAuthenticated={isAuthenticated}
                loginHref={loginHref}
                onAccept={handleAccept}
                registerHref={registerHref}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
});
AcceptInvitePage.displayName = "AcceptInvitePage";
