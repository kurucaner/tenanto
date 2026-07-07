import { type ReactNode, useEffect, useId } from "react";

import { usePropertyShellActionsStore } from "@/components/properties/property-shell-actions-store";

export function usePropertyShellActions(actions: ReactNode): void {
  const { register, unregister } = usePropertyShellActionsStore();
  const registrationId = useId();

  useEffect(() => {
    register(registrationId, actions);
    return () => {
      unregister(registrationId);
    };
  }, [actions, register, registrationId, unregister]);
}
