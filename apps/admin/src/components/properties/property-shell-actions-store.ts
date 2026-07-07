import { createContext, type ReactNode, useContext } from "react";

export interface PropertyShellActionsStore {
  getSnapshot: () => ReactNode;
  register: (registrationId: string, actions: ReactNode) => void;
  subscribe: (listener: () => void) => () => void;
  unregister: (registrationId: string) => void;
}

export function createPropertyShellActionsStore(): PropertyShellActionsStore {
  let actions: ReactNode = null;
  let ownerId: string | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => actions,
    register: (registrationId, nextActions) => {
      if (Object.is(actions, nextActions) && ownerId === registrationId) {
        return;
      }
      ownerId = registrationId;
      actions = nextActions;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    unregister: (registrationId) => {
      if (ownerId !== registrationId) {
        return;
      }
      ownerId = null;
      actions = null;
      notify();
    },
  };
}

export const PropertyShellActionsContext = createContext<PropertyShellActionsStore | null>(null);

export function usePropertyShellActionsStore(): PropertyShellActionsStore {
  const store = useContext(PropertyShellActionsContext);
  if (store == null) {
    throw new Error(
      "PropertyShellActionsContext is missing. Wrap with PropertyShellActionsProvider."
    );
  }
  return store;
}
