import { Outlet } from "react-router-dom";

import { DatadogRumUserSync } from "@/components/datadog-rum-user-sync";
import { DatadogRumViewTracker } from "@/components/datadog-rum-view-tracker";
import { SessionSync } from "@/components/session-sync";
import { TooltipProvider } from "@/components/ui/tooltip";

export const RootLayout = () => (
  <TooltipProvider delayDuration={200}>
    <SessionSync />
    <DatadogRumViewTracker />
    <DatadogRumUserSync />
    <Outlet />
  </TooltipProvider>
);
