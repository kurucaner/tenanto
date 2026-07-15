import { memo, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { APP_NAME } from "@/packages/shared";

import { DarkPaletteMenu } from "../components/dark-palette-menu";
import { ThemeSwitcher } from "../components/theme-switcher";
import { useResolvedDark } from "../components/use-resolved-dark";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";

export interface IAuthPageShellProps {
  brandLabel: string;
  cardDescription: string;
  cardTitle: string;
  children: ReactNode;
  isAuthenticated: boolean;
  isAuthHydrated: boolean;
  onSubmit?: () => void;
  redirectWhenAuthed: string;
  subtitle: string;
  surfaceClassName?: string;
}

export const AuthPageShell = memo(
  ({
    brandLabel,
    cardDescription,
    cardTitle,
    children,
    isAuthenticated,
    isAuthHydrated,
    onSubmit,
    redirectWhenAuthed,
    subtitle,
    surfaceClassName = "app-surface",
  }: IAuthPageShellProps) => {
    const resolvedDark = useResolvedDark();

    if (isAuthHydrated && isAuthenticated) {
      return <Navigate replace to={redirectWhenAuthed} />;
    }

    const formContent = onSubmit ? <form onSubmit={onSubmit}>{children}</form> : children;

    return (
      <div
        className={`${surfaceClassName} relative flex min-h-svh flex-col items-center justify-center gap-10 p-6`}
      >
        <div className="absolute end-4 top-4 z-10 flex items-center gap-2">
          {resolvedDark ? <DarkPaletteMenu /> : null}
          <ThemeSwitcher />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {brandLabel}
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

interface IAuthCardBodyProps {
  children: ReactNode;
}

export const AuthCardBody = memo(({ children }: IAuthCardBodyProps) => (
  <CardContent className="mb-4 flex flex-col gap-4">{children}</CardContent>
));
AuthCardBody.displayName = "AuthCardBody";

interface IAuthCardFooterProps {
  children: ReactNode;
}

export const AuthCardFooter = memo(({ children }: IAuthCardFooterProps) => (
  <CardFooter className="flex flex-col gap-3">{children}</CardFooter>
));
AuthCardFooter.displayName = "AuthCardFooter";
