import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";

import { PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { type IPropertyShellOutletContext } from "@/hooks/use-property-shell-actions";
import { propertiesApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";

import { PropertyShellProvider } from "./property-shell-context";

const PropertyShellDepthContext = createContext(false);

interface PropertyPageShellProps {
  actions?: ReactNode;
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

export const PropertyPageShell = memo(
  ({ actions, children, propertyId, propertyName }: PropertyPageShellProps) => {
    const isNested = useContext(PropertyShellDepthContext);
    if (isNested) {
      throw new Error("PropertyPageShell cannot be nested inside another PropertyPageShell");
    }

    return (
      <PropertyShellDepthContext.Provider value={true}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link className="text-muted-foreground text-sm hover:underline" to="/properties">
              ← Properties
            </Link>
            <Separator className="h-4" orientation="vertical" />
            <span className="text-sm font-medium text-foreground">{propertyName}</span>
            <div className="ml-auto flex min-h-8 items-center gap-2">{actions}</div>
          </div>

          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max items-center gap-1 border-b">
              {PROPERTY_SHELL_TABS.map((tab) => (
                <NavLink
                  className={tabClass}
                  end={tab.end}
                  key={tab.path || "overview"}
                  to={
                    tab.path
                      ? `/properties/${propertyId}/${tab.path}`
                      : `/properties/${propertyId}`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </div>
          </div>

          {children}
        </div>
      </PropertyShellDepthContext.Provider>
    );
  }
);
PropertyPageShell.displayName = "PropertyPageShell";

export const PropertyShellLayout = memo(() => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [actions, setActions] = useState<ReactNode>(null);

  const handleSetActions = useCallback((next: ReactNode) => {
    setActions(next);
  }, []);

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
        {detailQuery.error instanceof Error
          ? detailQuery.error.message
          : "Property not found"}
      </p>
    );
  }

  const property = detailQuery.data.property;
  const outletContext: IPropertyShellOutletContext = { setActions: handleSetActions };

  return (
    <PropertyShellProvider property={property} propertyId={propertyId}>
      <PropertyPageShell actions={actions} propertyId={propertyId} propertyName={property.name}>
        <Outlet context={outletContext} />
      </PropertyPageShell>
    </PropertyShellProvider>
  );
});
PropertyShellLayout.displayName = "PropertyShellLayout";
