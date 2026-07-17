import { memo, useEffect } from "react";

import type { IDatadogRumUser } from "./types";

interface IDatadogRumUserSyncProps {
  clearUser: () => void;
  setUser: (user: IDatadogRumUser) => void;
  user: IDatadogRumUser | null;
}

export const DatadogRumUserSync = memo(function DatadogRumUserSync({
  clearUser,
  setUser,
  user,
}: IDatadogRumUserSyncProps) {
  useEffect(() => {
    if (user) {
      setUser(user);
      return;
    }

    clearUser();
  }, [clearUser, setUser, user]);

  return null;
});
DatadogRumUserSync.displayName = "DatadogRumUserSync";
