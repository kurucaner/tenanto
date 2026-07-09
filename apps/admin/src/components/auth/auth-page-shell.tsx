import { memo, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { AdminDarkPaletteMenu } from "@/components/admin-dark-palette-menu";
import { AdminThemeSwitcher } from "@/components/admin-theme-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { useResolvedAdminDark } from "@/hooks/use-resolved-admin-dark";
import { APP_NAME } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

interface AuthPageShellProps {
  cardDescription: string;
  cardTitle: string;
  children: ReactNode;
  onSubmit?: () => void;
  subtitle: string;
}

export const AuthPageShell = memo(
  ({ cardDescription, cardTitle, children, onSubmit, subtitle }: AuthPageShellProps) => {
    const resolvedDark = useResolvedAdminDark();
    const hydrated = useAuthHydrated();
    const accessToken = useAuthStore((s) => s.accessToken);
    const user = useAuthStore((s) => s.user);

    if (hydrated && accessToken && user) {
      return <Navigate replace to="/home" />;
    }

    const formContent = onSubmit ? <form onSubmit={onSubmit}>{children}</form> : children;

    return (
      <div className="admin-app-surface relative flex min-h-svh flex-col items-center justify-center gap-10 p-6">
        <div className="absolute end-4 top-4 z-10 flex items-center gap-2">
          {resolvedDark ? <AdminDarkPaletteMenu /> : null}
          <AdminThemeSwitcher />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Workspace
          </p>
          <p className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {APP_NAME}
          </p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Card className="w-full max-w-sm rounded-2xl border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="font-display text-2xl font-semibold tracking-tight">
              {cardTitle}
            </CardTitle>
            <CardDescription>{cardDescription}</CardDescription>
          </CardHeader>
          {formContent}
        </Card>
      </div>
    );
  }
);
AuthPageShell.displayName = "AuthPageShell";

interface AuthCardBodyProps {
  children: ReactNode;
}

export const AuthCardBody = memo(({ children }: AuthCardBodyProps) => (
  <CardContent className="mb-4 flex flex-col gap-4">{children}</CardContent>
));
AuthCardBody.displayName = "AuthCardBody";

interface AuthCardFooterProps {
  children: ReactNode;
}

export const AuthCardFooter = memo(({ children }: AuthCardFooterProps) => (
  <CardFooter className="flex flex-col gap-3">{children}</CardFooter>
));
AuthCardFooter.displayName = "AuthCardFooter";
