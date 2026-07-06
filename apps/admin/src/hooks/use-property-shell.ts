import { useContext } from "react";

import {
  type IPropertyShellContext,
  PropertyShellContext,
} from "@/components/properties/property-shell-context-value";

export type { IPropertyShellContext };

export function usePropertyShell(): IPropertyShellContext {
  const context = useContext(PropertyShellContext);
  if (!context) {
    throw new Error("usePropertyShell must be used within PropertyShellProvider");
  }
  return context;
}
