import { memo, useState } from "react";
import { Link } from "react-router-dom";

import { tenantAuthApi, tenantPortalApi } from "@/lib/api-client";
import { clearAppSession } from "@/lib/clear-app-session";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DarkPaletteMenu,
  Input,
  Label,
  ThemeSwitcher,
  useResolvedDark,
} from "@/packages/app-ui";
import { APP_NAME } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const SessionDebugPanel = memo(function SessionDebugPanel() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [draftAccessToken, setDraftAccessToken] = useState("");
  const [draftRefreshToken, setDraftRefreshToken] = useState("");
  const [meResult, setMeResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    setMeResult(null);
    try {
      const session = await tenantAuthApi.login({ email, password });
      setSession(session);
      setMeResult(`Logged in as ${session.user.email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLoadSession = () => {
    if (!user || !draftAccessToken.trim() || !draftRefreshToken.trim()) {
      setError("Log in first or keep an existing user in the store before loading tokens.");
      return;
    }
    setSession({
      accessToken: draftAccessToken.trim(),
      refreshToken: draftRefreshToken.trim(),
      user,
    });
    setError(null);
  };

  const handleFetchMe = async () => {
    setBusy(true);
    setError(null);
    setMeResult(null);
    try {
      const data = await tenantPortalApi.getMe();
      setMeResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    const token = useAuthStore.getState().refreshToken;
    if (!token) {
      setError("No refresh token in session");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await tenantAuthApi.refresh({ refreshToken: token });
      useAuthStore.getState().setAccessToken(result.accessToken);
      useAuthStore.getState().setUser(result.user);
      setMeResult(`Refresh OK — new access token loaded for ${result.user.email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    const token = useAuthStore.getState().refreshToken;
    if (token) {
      try {
        await tenantAuthApi.logout({ refreshToken: token });
      } catch {
        // Ignore server errors during local teardown.
      }
    }
    clearAppSession();
    setMeResult(null);
    setError(null);
  };

  return (
    <Card className="w-full max-w-lg rounded-2xl border-dashed border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">Session debug (dev)</CardTitle>
        <CardDescription>
          Log in with email/password or paste tokens after a login. Removed in Phase 2.3 auth UI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-2">
          <Label htmlFor="debug-email">Email</Label>
          <Input
            id="debug-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tenant@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debug-password">Password</Label>
          <Input
            id="debug-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button disabled={busy} type="button" onClick={() => void handleLogin()}>
          Login
        </Button>
        <div className="space-y-2 border-t border-border/60 pt-3">
          <Label htmlFor="debug-access-token">Access token (optional)</Label>
          <Input
            id="debug-access-token"
            value={draftAccessToken}
            onChange={(e) => setDraftAccessToken(e.target.value)}
            placeholder="eyJ…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debug-refresh-token">Refresh token</Label>
          <Input
            id="debug-refresh-token"
            value={draftRefreshToken}
            onChange={(e) => setDraftRefreshToken(e.target.value)}
            placeholder="refresh token"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Session: {accessToken ? "access ✓" : "no access"} ·{" "}
          {refreshToken ? "refresh ✓" : "no refresh"} · {user ? user.email : "no user"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} type="button" variant="outline" onClick={handleLoadSession}>
            Load tokens
          </Button>
          <Button disabled={busy} type="button" onClick={() => void handleFetchMe()}>
            GET /tenant/me
          </Button>
          <Button disabled={busy} type="button" variant="secondary" onClick={() => void handleRefresh()}>
            Refresh session
          </Button>
          <Button disabled={busy} type="button" variant="destructive" onClick={() => void handleLogout()}>
            Logout
          </Button>
        </div>
        {error ? <p className="text-destructive">{error}</p> : null}
        {meResult ? (
          <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">{meResult}</pre>
        ) : null}
      </CardContent>
    </Card>
  );
});
SessionDebugPanel.displayName = "SessionDebugPanel";

export const HomePage = memo(function HomePage() {
  const resolvedDark = useResolvedDark();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

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
        <p className="text-sm text-muted-foreground">Tenant app — Phase 2.2 session layer</p>
      </div>
      <Card className="w-full max-w-sm rounded-2xl border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">
            {accessToken && user ? `Signed in as ${user.name}` : "Welcome"}
          </CardTitle>
          <CardDescription>
            Auth UI arrives in Phase 2.3. Use the dev panel or{" "}
            <Link className="text-foreground underline-offset-4 hover:underline" to="/account">
              /account
            </Link>{" "}
            when a session is loaded.
          </CardDescription>
        </CardHeader>
      </Card>
      {import.meta.env.DEV ? <SessionDebugPanel /> : null}
    </div>
  );
});
HomePage.displayName = "HomePage";
