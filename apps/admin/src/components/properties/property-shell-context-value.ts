import { createContext } from "react";

import { type IPropertyPermissions } from "@/hooks/use-property-permissions";
import type { IPropertyDetail } from "@/packages/shared";

export interface IPropertyShellContext {
  permissions: IPropertyPermissions;
  property: IPropertyDetail;
  propertyId: string;
}

export const PropertyShellContext = createContext<IPropertyShellContext | null>(null);
