import { memo } from "react";

import {
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
        <p className="text-sm text-muted-foreground">Tenant app scaffold (Phase 2.1)</p>
      </div>
      <Card className="w-full max-w-sm rounded-2xl border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">
            Coming soon
          </CardTitle>
          <CardDescription>
            Auth, invite acceptance, and lease views arrive in Phase 2.2–2.5.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Theme switcher and dark palettes are shared with the admin app via{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">packages/app-ui</code>.
        </CardContent>
      </Card>
    </div>
  );
});
HomePage.displayName = "HomePage";
