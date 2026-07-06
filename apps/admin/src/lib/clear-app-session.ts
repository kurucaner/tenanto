import { NOTIFICATION_STREAM_CLIENT_ID_KEY } from "@/lib/notification-stream-constants";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth-store";

export function clearAppSession(): void {
  queryClient.cancelQueries().catch(() => {
    // Ignore cancel errors during logout teardown.
  });
  queryClient.clear();
  sessionStorage.removeItem(NOTIFICATION_STREAM_CLIENT_ID_KEY);
  useAuthStore.getState().clearSession();
}
