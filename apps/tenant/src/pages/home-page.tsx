import { memo } from "react";
import { Link } from "react-router-dom";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DarkPaletteMenu,
  ThemeSwitcher,
  useResolvedDark,
} from "@/packages/app-ui";
import { APP_NAME } from "@/packages/shared";

export const HomePage = memo(function HomePage() {
  const resolvedDark = useResolvedDark();

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
        <p className="text-sm text-muted-foreground">Sign in to view your leases and invites.</p>
      </div>
      <Card className="w-full max-w-sm rounded-2xl border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">
            Welcome
          </CardTitle>
          <CardDescription>
            Create an account or sign in to access your resident portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full" type="button">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild className="w-full" type="button" variant="outline">
            <Link to="/register">Create account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
});
HomePage.displayName = "HomePage";
