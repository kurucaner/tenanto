import { memo, type ReactNode, useMemo } from "react";

import { PropertyShellContext } from "@/components/properties/property-shell-context-value";
import { usePropertyPermissions } from "@/hooks/use-property-permissions";
import type { IPropertyDetail } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

interface PropertyShellProviderProps {
  children: ReactNode;
  property: IPropertyDetail;
  propertyId: string;
}

export const PropertyShellProvider = memo(
  ({ children, property, propertyId }: PropertyShellProviderProps) => {
    const currentUser = useAuthStore((s) => s.user);
    const permissions = usePropertyPermissions(property, currentUser);
    const value = useMemo(
      () => ({ permissions, property, propertyId }),
      [permissions, property, propertyId]
    );

    return <PropertyShellContext.Provider value={value}>{children}</PropertyShellContext.Provider>;
  }
);
PropertyShellProvider.displayName = "PropertyShellProvider";
