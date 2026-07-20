import { memo } from "react";

import { CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { type IWorkspaceCommandSearchTip } from "@/hooks/use-workspace-command-search";
import { type IGlobalCommandPaletteItem } from "@/lib/global-command-palette-items";

interface WorkspaceCommandResultsProps {
  isSearching: boolean;
  navigationItems: IGlobalCommandPaletteItem[];
  onSelect: (path: string) => void;
  propertyItems: IGlobalCommandPaletteItem[];
  recentItems: IGlobalCommandPaletteItem[];
  searchTips: IWorkspaceCommandSearchTip[];
  showIdleTips?: boolean;
  showRecentWhenIdle?: boolean;
}

export const WorkspaceCommandResults = memo(
  ({
    isSearching,
    navigationItems,
    onSelect,
    propertyItems,
    recentItems,
    searchTips,
    showIdleTips = true,
    showRecentWhenIdle = false,
  }: WorkspaceCommandResultsProps) => (
    <CommandList className="max-h-[min(50vh,360px)]">
      {!isSearching && showIdleTips ? (
        <CommandGroup heading="Search tips">
          {searchTips.map((tip) => (
            <CommandItem key={tip.id} onSelect={() => onSelect(tip.path)} value={tip.keyword}>
              <span className="font-medium">{tip.keyword}:</span>
              <span className="text-muted-foreground"> — {tip.description}</span>
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() => onSelect("/properties")}
            value="properties search by name or address"
          >
            <span className="font-medium">properties:</span>
            <span className="text-muted-foreground"> — Search by name or address</span>
          </CommandItem>
        </CommandGroup>
      ) : null}
      {navigationItems.length > 0 ? (
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={item.value}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
      {(showRecentWhenIdle || isSearching) && recentItems.length > 0 ? (
        <>
          {navigationItems.length > 0 ? <CommandSeparator /> : null}
          <CommandGroup heading="Recent">
            {recentItems.map((item) => (
              <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={item.value}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      ) : null}
      {propertyItems.length > 0 ? (
        <>
          {navigationItems.length > 0 || recentItems.length > 0 ? <CommandSeparator /> : null}
          <CommandGroup heading="Properties">
            {propertyItems.map((item) => (
              <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={item.value}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      ) : null}
    </CommandList>
  )
);
WorkspaceCommandResults.displayName = "WorkspaceCommandResults";
