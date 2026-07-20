import { ArrowRight, X } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHomeWorkspaceProperties } from "@/hooks/use-home-workspace-properties";
import { resolveRecentPropertyTabLabel } from "@/lib/home-workspace-continue-utils";
import { buildPropertyResumePath } from "@/lib/property-switch-navigation";
import { type IRecentProperty, removeRecentProperty } from "@/lib/recent-properties-storage";

interface HomeWorkspaceContinueRowProps {
  recentEntry: IRecentProperty;
}

const HomeWorkspaceContinueRow = memo(({ recentEntry }: HomeWorkspaceContinueRowProps) => {
  const resumePath = buildPropertyResumePath(recentEntry.id, recentEntry.lastPath);
  const tabLabel = resolveRecentPropertyTabLabel(recentEntry);

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {recentEntry.name} · <span className="font-semibold">{tabLabel}</span>
          </p>
          <p className="text-muted-foreground truncate text-sm">{recentEntry.address}</p>
        </div>
        <Button asChild className="shrink-0 gap-2" variant="secondary">
          <Link to={resumePath}>
            Resume
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
});
HomeWorkspaceContinueRow.displayName = "HomeWorkspaceContinueRow";

interface HomeWorkspaceStaleContinueRowProps {
  onRemove: (propertyId: string) => void;
  recentEntry: IRecentProperty;
}

const HomeWorkspaceStaleContinueRow = memo(
  ({ onRemove, recentEntry }: HomeWorkspaceStaleContinueRowProps) => (
    <Card className="border-border/80 border-dashed bg-card/60 shadow-sm">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium">{recentEntry.name}</p>
          <p className="text-muted-foreground text-sm">
            This property is no longer accessible. Remove it from recents to clear the shortcut.
          </p>
        </div>
        <Button
          className="shrink-0 gap-2"
          onClick={() => onRemove(recentEntry.id)}
          type="button"
          variant="outline"
        >
          <X className="size-4" />
          Remove from recents
        </Button>
      </CardContent>
    </Card>
  )
);
HomeWorkspaceStaleContinueRow.displayName = "HomeWorkspaceStaleContinueRow";

export const HomeWorkspaceContinueSection = memo(() => {
  const { accessibleRecentEntries, staleRecentEntries } = useHomeWorkspaceProperties();

  if (accessibleRecentEntries.length === 0 && staleRecentEntries.length === 0) {
    return null;
  }

  return (
    <section aria-label="Continue" className="space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">Continue</h2>
      <div className="grid gap-3">
        {accessibleRecentEntries.map((recentEntry) => (
          <HomeWorkspaceContinueRow key={recentEntry.id} recentEntry={recentEntry} />
        ))}
        {staleRecentEntries.map((recentEntry) => (
          <HomeWorkspaceStaleContinueRow
            key={recentEntry.id}
            onRemove={removeRecentProperty}
            recentEntry={recentEntry}
          />
        ))}
      </div>
    </section>
  );
});
HomeWorkspaceContinueSection.displayName = "HomeWorkspaceContinueSection";
