import { memo, type ReactNode, useState, useSyncExternalStore } from "react";

import {
  createPropertyShellActionsStore,
  PropertyShellActionsContext,
  usePropertyShellActionsStore,
} from "@/components/properties/property-shell-actions-store";

export const PropertyShellActionsProvider = memo(({ children }: { children: ReactNode }) => {
  const [store] = useState(createPropertyShellActionsStore);

  return (
    <PropertyShellActionsContext.Provider value={store}>
      {children}
    </PropertyShellActionsContext.Provider>
  );
});
PropertyShellActionsProvider.displayName = "PropertyShellActionsProvider";

export const PropertyShellHeaderActions = memo(() => {
  const { getSnapshot, subscribe } = usePropertyShellActionsStore();
  const actions = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return <div className="ml-auto flex min-h-8 items-center gap-2">{actions}</div>;
});
PropertyShellHeaderActions.displayName = "PropertyShellHeaderActions";
