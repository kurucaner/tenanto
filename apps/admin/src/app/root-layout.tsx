import { Outlet } from "react-router-dom";

import { SessionSync } from "@/components/session-sync";
import { TooltipProvider } from "@/components/ui/tooltip";

export const RootLayout = () => (
  <TooltipProvider delayDuration={200}>
    <SessionSync />
    <Outlet />
  </TooltipProvider>
);
