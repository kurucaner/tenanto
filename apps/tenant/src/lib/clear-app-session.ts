import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth-store";

export function clearAppSession(): void {
  queryClient.cancelQueries().catch(() => {
    // Ignore cancel errors during logout teardown.
  });
  queryClient.clear();
  useAuthStore.getState().clearSession();
}
