import { memo } from "react";
import { Outlet } from "react-router-dom";

import { DocumentTitleSync } from "@/components/document-title-sync";
import { SessionSync } from "@/components/session-sync";
import {
  clearDatadogRumUser,
  setDatadogRumUser,
  trackDatadogRumView,
} from "@/lib/datadog-rum";
import {
  DatadogRumUserSync,
  DatadogRumViewTracker,
} from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

export const RootLayout = memo(function RootLayout() {
  const user = useAuthStore((state) => state.user);

  return (
    <>
      <DocumentTitleSync />
      <SessionSync />
      <DatadogRumViewTracker trackView={trackDatadogRumView} />
      <DatadogRumUserSync
        clearUser={clearDatadogRumUser}
        setUser={setDatadogRumUser}
        user={user}
      />
      <Outlet />
    </>
  );
});
RootLayout.displayName = "RootLayout";
