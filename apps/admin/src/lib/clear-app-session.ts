import { NOTIFICATION_STREAM_CLIENT_ID_KEY } from "@/lib/notification-stream-constants";
import { queryClient } from "@/lib/query-client";
import { removePersistedQueryCache } from "@/lib/query-persist-config";
import { clearRecentProperties } from "@/lib/recent-properties-storage";
import { useAuthStore } from "@/stores/auth-store";

export function clearAppSession(): void {
  queryClient.cancelQueries().catch(() => {
    // Ignore cancel errors during logout teardown.
  });
  queryClient.clear();
  removePersistedQueryCache();
  sessionStorage.removeItem(NOTIFICATION_STREAM_CLIENT_ID_KEY);
  clearRecentProperties();
  useAuthStore.getState().clearSession();
}
