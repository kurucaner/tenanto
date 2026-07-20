import { Building2, ChevronRight } from "lucide-react";
import { memo } from "react";

import { HomeColumnPanel, HomeColumnRow } from "@/components/home/home-column-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHomeWorkspaceProperties } from "@/hooks/use-home-workspace-properties";
import { buildPropertyShellTabPath } from "@/lib/property-shell-tab-navigation";

const HOME_PROPERTIES_COLUMN_MAX = 6;

export const HomePropertiesColumn = memo(() => {
  const { error, isError, isPending, properties, refetch } = useHomeWorkspaceProperties();
  const visibleProperties = properties.slice(0, HOME_PROPERTIES_COLUMN_MAX);

  if (isPending) {
    return (
      <HomeColumnPanel headerHref="/properties" title="Properties">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex min-h-11 items-center gap-2.5 px-3 py-2" key={index}>
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </HomeColumnPanel>
    );
  }

  if (isError && visibleProperties.length === 0) {
    return (
      <HomeColumnPanel headerHref="/properties" title="Properties">
        <div className="flex flex-col gap-2 px-3 py-4">
          <p className="text-destructive text-xs">
            {error instanceof Error ? error.message : "Could not load properties."}
          </p>
          <Button onClick={() => void refetch()} size="sm" type="button" variant="outline">
            Try again
          </Button>
        </div>
      </HomeColumnPanel>
    );
  }

  if (visibleProperties.length === 0) {
    return (
      <HomeColumnPanel emptyMessage="Add something new" headerHref="/properties" title="Properties" />
    );
  }

  return (
    <HomeColumnPanel headerHref="/properties" title="Properties">
      {visibleProperties.map((property) => (
        <HomeColumnRow
          href={buildPropertyShellTabPath(property.id, { label: "Overview", path: "" })}
          key={property.id}
        >
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{property.name}</span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </HomeColumnRow>
      ))}
    </HomeColumnPanel>
  );
});
HomePropertiesColumn.displayName = "HomePropertiesColumn";
