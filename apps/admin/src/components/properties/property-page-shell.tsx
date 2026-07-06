import type { ReactNode } from "react";
import { memo } from "react";
import { Link, NavLink } from "react-router-dom";

import { Separator } from "@/components/ui/separator";

interface PropertyPageShellProps {
  actions?: ReactNode;
  children: ReactNode;
  propertyId: string;
  propertyName: string;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 pb-2 text-sm font-medium transition-colors ${
    isActive
      ? "border-b-2 border-foreground text-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;

export const PropertyPageShell = memo(
  ({ actions, children, propertyId, propertyName }: PropertyPageShellProps) => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link className="text-muted-foreground text-sm hover:underline" to="/properties">
          ← Properties
        </Link>
        <Separator className="h-4" orientation="vertical" />
        <span className="text-sm font-medium text-foreground">{propertyName}</span>
        <div className="ml-auto flex min-h-8 items-center gap-2">{actions}</div>
      </div>

      <div className="flex items-center gap-1 border-b">
        <NavLink className={tabClass} end to={`/properties/${propertyId}`}>
          Overview
        </NavLink>
        <NavLink className={tabClass} to={`/properties/${propertyId}/units`}>
          Units
        </NavLink>
        <NavLink className={tabClass} to={`/properties/${propertyId}/income`}>
          Income
        </NavLink>
        <NavLink className={tabClass} to={`/properties/${propertyId}/settings`}>
          Settings
        </NavLink>
      </div>

      {children}
    </div>
  )
);
PropertyPageShell.displayName = "PropertyPageShell";
