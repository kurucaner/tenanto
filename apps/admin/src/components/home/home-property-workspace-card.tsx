import { ArrowRight } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { PropertyFavoriteButton } from "@/components/properties/property-favorite-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { derivePropertyPermissionsFromListItem } from "@/hooks/use-property-permissions";
import { useSetPropertyFavorite } from "@/hooks/use-set-property-favorite";
import { HOME_WORKSPACE_PROPERTIES_LIST_LIMIT } from "@/lib/home-workspace-properties-utils";
import { getVisiblePropertyLauncherDestinations } from "@/lib/property-launcher-destinations";
import { buildPropertyShellTabPath } from "@/lib/property-shell-tab-navigation";
import { type IProperty, type IUser } from "@/packages/shared";

const HOME_WORKSPACE_FAVORITE_LIST_FILTERS = {
  limit: HOME_WORKSPACE_PROPERTIES_LIST_LIMIT,
} as const;

interface HomePropertyWorkspaceCardProps {
  currentUser: IUser | null;
  property: IProperty;
}

interface HomePropertyWorkspaceShortcutProps {
  label: string;
  to: string;
}

const HomePropertyWorkspaceShortcut = memo(({ label, to }: HomePropertyWorkspaceShortcutProps) => (
  <Button asChild className="h-7 px-2.5 text-xs" size="sm" variant="secondary">
    <Link to={to}>{label}</Link>
  </Button>
));
HomePropertyWorkspaceShortcut.displayName = "HomePropertyWorkspaceShortcut";

export const HomePropertyWorkspaceCard = memo(
  ({ currentUser, property }: HomePropertyWorkspaceCardProps) => {
    const favoriteMutation = useSetPropertyFavorite(HOME_WORKSPACE_FAVORITE_LIST_FILTERS);
    const permissions = derivePropertyPermissionsFromListItem(property, currentUser);
    const homeDestinations = getVisiblePropertyLauncherDestinations(permissions).filter(
      (destination) => destination.showOnHome
    );
    const propertyOverviewPath = buildPropertyShellTabPath(property.id, {
      label: "Overview",
      path: "",
    });
    const isFavoritePending =
      favoriteMutation.isPending && favoriteMutation.variables?.propertyId === property.id;

    return (
      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <PropertyFavoriteButton
              disabled={isFavoritePending}
              isFavorite={property.isFavorite}
              onToggle={() =>
                favoriteMutation.mutate({
                  favorite: !property.isFavorite,
                  propertyId: property.id,
                })
              }
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold">{property.name}</h3>
              <p className="text-muted-foreground truncate text-sm">{property.address}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {homeDestinations.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {homeDestinations.map((destination) => (
                <HomePropertyWorkspaceShortcut
                  key={destination.path}
                  label={destination.label}
                  to={buildPropertyShellTabPath(property.id, destination)}
                />
              ))}
            </div>
          ) : null}
          <Button asChild className="gap-2" variant="secondary">
            <Link to={propertyOverviewPath}>
              Open property
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
);
HomePropertyWorkspaceCard.displayName = "HomePropertyWorkspaceCard";
