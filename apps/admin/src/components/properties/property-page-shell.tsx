import { useQuery } from "@tanstack/react-query";
import { createContext, memo, type ReactNode, useContext, useEffect } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";

import {
  PropertyShellActionsProvider,
  PropertyShellHeaderActions,
} from "@/components/properties/property-shell-actions-context";
import { PropertySwitcher } from "@/components/properties/property-switcher";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";
import { propertiesApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { recordRecentProperty } from "@/lib/recent-properties-storage";
import { type IPropertyDetail } from "@/packages/shared";

import { PropertyShellProvider } from "./property-shell-context";

const PropertyShellDepthContext = createContext(false);

interface PropertyPageShellProps {
  children: ReactNode;
  propertyId: string;
  propertyName: string;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 px-3 pb-2 text-sm font-medium transition-colors ${
    isActive
      ? "border-b-2 border-foreground text-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;

export const PropertyShellTabs = memo(({ propertyId }: { propertyId: string }) => (
  <div className="-mx-1 px-1">
    <div className="flex flex-wrap items-center gap-1 border-b">
      {PROPERTY_SHELL_TABS.map((tab) => (
        <NavLink
          className={tabClass}
          end={tab.end}
          key={tab.path || "overview"}
          to={tab.path ? `/properties/${propertyId}/${tab.path}` : `/properties/${propertyId}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  </div>
));
PropertyShellTabs.displayName = "PropertyShellTabs";

export const PropertyPageShell = memo(
  ({ children, propertyId, propertyName }: PropertyPageShellProps) => {
    const isNested = useContext(PropertyShellDepthContext);
    if (isNested) {
      throw new Error("PropertyPageShell cannot be nested inside another PropertyPageShell");
    }

    return (
      <PropertyShellDepthContext.Provider value={true}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="text-muted-foreground text-sm hover:underline" to="/properties">
              ← Properties
            </Link>
            <Separator className="h-4" orientation="vertical" />
            <PropertySwitcher propertyId={propertyId} propertyName={propertyName} />
            <PropertyShellHeaderActions />
          </div>

          <PropertyShellTabs propertyId={propertyId} />

          {children}
        </div>
      </PropertyShellDepthContext.Provider>
    );
  }
);
PropertyPageShell.displayName = "PropertyPageShell";

const PropertyShellLayoutContent = memo(
  ({ property, propertyId }: { property: IPropertyDetail; propertyId: string }) => {
    useEffect(() => {
      recordRecentProperty({
        address: property.address,
        id: property.id,
        name: property.name,
      });
    }, [property.address, property.id, property.name]);

    return (
      <PropertyShellProvider property={property} propertyId={propertyId}>
        <PropertyShellActionsProvider>
          <PropertyPageShell propertyId={propertyId} propertyName={property.name}>
            <Outlet />
          </PropertyPageShell>
        </PropertyShellActionsProvider>
      </PropertyShellProvider>
    );
  }
);
PropertyShellLayoutContent.displayName = "PropertyShellLayoutContent";

export const PropertyShellLayout = memo(() => {
  const { propertyId } = useParams<{ propertyId: string }>();

  const detailQuery = useQuery({
    enabled: Boolean(propertyId),
    queryFn: () => propertiesApi.getDetail(propertyId!), // NOSONAR
    queryKey: adminQueryKeys.propertyDetail(propertyId!), // NOSONAR
  });

  if (!propertyId) {
    return <p className="text-muted-foreground text-sm">Invalid property.</p>;
  }

  if (detailQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data?.property) {
    return (
      <p className="text-destructive text-sm">
        {detailQuery.error instanceof Error ? detailQuery.error.message : "Property not found"}
      </p>
    );
  }

  const property = detailQuery.data.property;

  return <PropertyShellLayoutContent property={property} propertyId={propertyId} />;
});
PropertyShellLayout.displayName = "PropertyShellLayout";
