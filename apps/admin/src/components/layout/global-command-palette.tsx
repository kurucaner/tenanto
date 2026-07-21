import { memo } from "react";
import { useNavigate } from "react-router-dom";

import { WorkspaceCommandResults } from "@/components/home/workspace-command-results";
import { CommandDialog, CommandInput } from "@/components/ui/command";
import { useGlobalCommandPalette } from "@/hooks/use-global-command-palette";
import { useWorkspaceCommandSearch } from "@/hooks/use-workspace-command-search";

interface GlobalCommandPaletteProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const GlobalCommandPalette = memo(({ onOpenChange, open }: GlobalCommandPaletteProps) => {
  const navigate = useNavigate();
  const searchState = useWorkspaceCommandSearch({ enabled: open });

  const handleSelect = (path: string) => {
    onOpenChange(false);
    searchState.resetSearch();
    navigate(path);
  };

  return (
    <CommandDialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          searchState.resetSearch();
        }
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <CommandInput
        onValueChange={searchState.setSearch}
        placeholder="Search pages, properties, or destinations…"
        value={searchState.search}
      />
      <WorkspaceCommandResults
        isFetching={searchState.isFetching}
        isPending={searchState.isPending}
        isSearching={searchState.isSearching}
        navigationItems={searchState.navigationItems}
        onSelect={handleSelect}
        propertiesGroupHeading={searchState.propertiesGroupHeading}
        propertyItems={searchState.propertyItems}
        recentItems={searchState.recentItems}
        searchTips={searchState.searchTips}
        showRecentWhenIdle
      />

      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Tip: search for a property, then jump to Expenses, Leases, and more.
      </div>
    </CommandDialog>
  );
});
GlobalCommandPalette.displayName = "GlobalCommandPalette";

export const GlobalCommandPaletteHost = memo(() => {
  const { open, setOpen } = useGlobalCommandPalette();

  return <GlobalCommandPalette onOpenChange={setOpen} open={open} />;
});
GlobalCommandPaletteHost.displayName = "GlobalCommandPaletteHost";
