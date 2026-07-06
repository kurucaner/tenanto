import { createContext, memo, useContext, type ReactNode } from "react";

import {
  type IPropertyPermissions,
  usePropertyPermissions,
} from "@/hooks/use-property-permissions";
import type { IPropertyDetail } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export interface IPropertyShellContext {
  permissions: IPropertyPermissions;
  property: IPropertyDetail;
  propertyId: string;
}

const PropertyShellContext = createContext<IPropertyShellContext | null>(null);

interface PropertyShellProviderProps {
  children: ReactNode;
  property: IPropertyDetail;
  propertyId: string;
}

export const PropertyShellProvider = memo(
  ({ children, property, propertyId }: PropertyShellProviderProps) => {
    const currentUser = useAuthStore((s) => s.user);
    const permissions = usePropertyPermissions(property, currentUser);

    return (
      <PropertyShellContext.Provider value={{ permissions, property, propertyId }}>
        {children}
      </PropertyShellContext.Provider>
    );
  }
);
PropertyShellProvider.displayName = "PropertyShellProvider";

export function usePropertyShell(): IPropertyShellContext {
  const context = useContext(PropertyShellContext);
  if (!context) {
    throw new Error("usePropertyShell must be used within PropertyShellProvider");
  }
  return context;
}
