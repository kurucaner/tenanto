import { memo } from "react";
import { Outlet } from "react-router-dom";

import { SessionSync } from "@/components/session-sync";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clearDatadogRumUser, setDatadogRumUser, trackDatadogRumView } from "@/lib/datadog-rum";
import { DatadogRumUserSync, DatadogRumViewTracker } from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

export const RootLayout = memo(function RootLayout() {
  const user = useAuthStore((state) => state.user);

  return (
    <TooltipProvider delayDuration={200}>
      <SessionSync />
      <DatadogRumViewTracker trackView={trackDatadogRumView} />
      <DatadogRumUserSync clearUser={clearDatadogRumUser} setUser={setDatadogRumUser} user={user} />
      <Outlet />
    </TooltipProvider>
  );
});
RootLayout.displayName = "RootLayout";
