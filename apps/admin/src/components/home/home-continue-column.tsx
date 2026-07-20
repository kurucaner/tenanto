import { ChevronRight, Compass, History, X } from "lucide-react";
import { memo } from "react";

import { HomeColumnPanel, HomeColumnRow } from "@/components/home/home-column-panel";
import { Button } from "@/components/ui/button";
import { useHomeWorkspaceProperties } from "@/hooks/use-home-workspace-properties";
import { resolveRecentPropertyTabLabel } from "@/lib/home-workspace-continue-utils";
import { buildPropertyResumePath } from "@/lib/property-switch-navigation";
import { removeRecentProperty } from "@/lib/recent-properties-storage";

export const HomeContinueColumn = memo(() => {
  const { accessibleRecentEntries, staleRecentEntries } = useHomeWorkspaceProperties();
  const hasEntries = accessibleRecentEntries.length > 0 || staleRecentEntries.length > 0;

  if (!hasEntries) {
    return (
      <HomeColumnPanel emptyIcon={Compass} emptyMessage="Explore something new" title="Continue" />
    );
  }

  return (
    <HomeColumnPanel title="Continue">
      {accessibleRecentEntries.map((recentEntry) => {
        const tabLabel = resolveRecentPropertyTabLabel(recentEntry);
        const resumePath = buildPropertyResumePath(recentEntry.id, recentEntry.lastPath);

        return (
          <HomeColumnRow href={resumePath} key={recentEntry.id}>
            <History className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-muted-foreground">{recentEntry.name}</span>
              <span className="text-muted-foreground/70"> / </span>
              <span>{tabLabel}</span>
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </HomeColumnRow>
        );
      })}
      {staleRecentEntries.map((recentEntry) => (
        <div
          className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm"
          key={recentEntry.id}
        >
          <History className="size-4 shrink-0 text-muted-foreground/60" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-muted-foreground">{recentEntry.name}</p>
            <p className="text-muted-foreground/80 text-xs">No longer accessible</p>
          </div>
          <Button
            aria-label={`Remove ${recentEntry.name} from recents`}
            className="size-7 shrink-0"
            onClick={() => removeRecentProperty(recentEntry.id)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
    </HomeColumnPanel>
  );
});
HomeContinueColumn.displayName = "HomeContinueColumn";
