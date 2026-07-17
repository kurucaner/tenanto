import { memo } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { useAuthStore } from "@/stores/auth-store";

const HydrationFallback = memo(() => (
  <div className="flex min-h-svh items-center justify-center p-6">
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
    </div>
  </div>
));
HydrationFallback.displayName = "HydrationFallback";

const ProtectedRouteInner = memo(() => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthHydrated();

  if (!hydrated) {
    return <HydrationFallback />;
  }

  if (!accessToken || !user) {
    return <Navigate replace to="/login" />;
  }

  return <Outlet />;
});
ProtectedRouteInner.displayName = "ProtectedRouteInner";

export const ProtectedRoute = ProtectedRouteInner;
