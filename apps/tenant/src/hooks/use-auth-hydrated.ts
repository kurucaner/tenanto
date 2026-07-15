import { useEffect, useState } from "react";

import { useAuthStore } from "@/stores/auth-store";

export const useAuthHydrated = (): boolean => {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    return useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
};
