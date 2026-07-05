import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AdminDarkPaletteMenu } from "@/components/admin-dark-palette-menu";
import { AdminThemeSwitcher } from "@/components/admin-theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { useResolvedAdminDark } from "@/hooks/use-resolved-admin-dark";
import { authApi } from "@/lib/api-client";
import { APP_NAME, UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPageInner = memo(() => {
  const resolvedDark = useResolvedAdminDark();
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(loginSchema),
  });

  if (hydrated && accessToken && user?.userType === UserType.ADMIN) {
    return <Navigate replace to="/home" />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const res = await authApi.loginEmail(values.email.trim(), values.password);
      if (res.user.userType !== UserType.ADMIN) {
        toast.error("This account is not an admin.");
        return;
      }
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      toast.success("Signed in");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="admin-app-surface relative flex min-h-svh flex-col items-center justify-center gap-10 p-6">
      <div className="absolute end-4 top-4 z-10 flex items-center gap-2">
        {resolvedDark ? <AdminDarkPaletteMenu /> : null}
        <AdminThemeSwitcher />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Admin access
        </p>
        <p className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {APP_NAME}
        </p>
        <p className="text-sm text-muted-foreground">Sign in to the operations console.</p>
      </div>
      <Card className="w-full max-w-sm rounded-2xl border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">
            Sign in
          </CardTitle>
          <CardDescription>Use your admin email and password.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                autoComplete="email"
                id="admin-email"
                inputMode="email"
                type="email"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                autoComplete="current-password"
                id="admin-password"
                type="password"
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
});
LoginPageInner.displayName = "LoginPageInner";

export const LoginPage = LoginPageInner;
