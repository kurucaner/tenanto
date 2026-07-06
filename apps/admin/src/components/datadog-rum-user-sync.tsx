import { memo, useEffect } from "react";

import { clearDatadogRumUser, setDatadogRumUser } from "@/lib/datadog-rum";
import { useAuthStore } from "@/stores/auth-store";

const DatadogRumUserSyncInner = memo(() => {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      setDatadogRumUser(user);
      return;
    }

    clearDatadogRumUser();
  }, [user]);

  return null;
});
DatadogRumUserSyncInner.displayName = "DatadogRumUserSync";

export const DatadogRumUserSync = DatadogRumUserSyncInner;
