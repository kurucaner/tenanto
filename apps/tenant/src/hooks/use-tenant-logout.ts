import { useCallback } from "react";

import { tenantAuthApi } from "@/lib/api-client";
import { clearAppSession } from "@/lib/clear-app-session";
import { useAuthStore } from "@/stores/auth-store";

export function useTenantLogout() {
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return useCallback(async () => {
    if (refreshToken) {
      try {
        await tenantAuthApi.logout({ refreshToken });
      } catch {
        // Clear local session even if server logout fails.
      }
    }
    clearAppSession();
  }, [refreshToken]);
}
