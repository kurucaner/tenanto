import { ArrowRight } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";
import { resolveActivePropertyShellTab } from "@/lib/property-shell-tab-navigation";
import { buildPropertyResumePath } from "@/lib/property-switch-navigation";
import { type IRecentProperty } from "@/lib/recent-properties-storage";

interface HomeWorkspaceContinueSectionProps {
  recentEntries: IRecentProperty[];
}

function resolveRecentPropertyTabLabel(recentEntry: IRecentProperty): string {
  const resumePathname = buildPropertyResumePath(recentEntry.id, recentEntry.lastPath);

  return resolveActivePropertyShellTab(resumePathname, recentEntry.id, PROPERTY_SHELL_TABS).label;
}

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
        <Button asChild className="gap-2 shrink-0" variant="secondary">
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

export const HomeWorkspaceContinueSection = memo(
  ({ recentEntries }: HomeWorkspaceContinueSectionProps) => {
    if (recentEntries.length === 0) {
      return null;
    }

    return (
      <section aria-label="Continue" className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Continue</h2>
        <div className="grid gap-3">
          {recentEntries.map((recentEntry) => (
            <HomeWorkspaceContinueRow key={recentEntry.id} recentEntry={recentEntry} />
          ))}
        </div>
      </section>
    );
  }
);
HomeWorkspaceContinueSection.displayName = "HomeWorkspaceContinueSection";

export { resolveRecentPropertyTabLabel };
