import { useEffect, type ReactNode } from "react";
import { useOutletContext } from "react-router-dom";

export interface IPropertyShellOutletContext {
  setActions: (actions: ReactNode) => void;
}

export function usePropertyShellActions(actions: ReactNode): void {
  const { setActions } = useOutletContext<IPropertyShellOutletContext>();

  useEffect(() => {
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);
}
