import { memo } from "react";

import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { type IWorkspaceCommandSearchTip } from "@/hooks/use-workspace-command-search";
import { type IGlobalCommandPaletteItem } from "@/lib/global-command-palette-items";

const WORKSPACE_COMMAND_RESULTS_SKELETON_COUNT = 3;

interface WorkspaceCommandResultsProps {
  isFetching: boolean;
  isPending: boolean;
  isSearching: boolean;
  navigationItems: IGlobalCommandPaletteItem[];
  onSelect: (path: string) => void;
  propertiesGroupHeading?: string;
  propertyItems: IGlobalCommandPaletteItem[];
  recentItems: IGlobalCommandPaletteItem[];
  searchTips: IWorkspaceCommandSearchTip[];
  showIdleTips?: boolean;
  showRecentWhenIdle?: boolean;
}

export const WorkspaceCommandResults = memo(
  ({
    isFetching,
    isPending,
    isSearching,
    navigationItems,
    onSelect,
    propertiesGroupHeading,
    propertyItems,
    recentItems,
    searchTips,
    showIdleTips = true,
    showRecentWhenIdle = false,
  }: WorkspaceCommandResultsProps) => {
    const isResultsLoading = isSearching && !propertyItems.length && (isPending || isFetching);

    return (
      <CommandList aria-busy={isResultsLoading} className="max-h-[min(50vh,360px)]">
        {isResultsLoading ? (
          <div aria-hidden className="space-y-1 p-1">
            {Array.from({ length: WORKSPACE_COMMAND_RESULTS_SKELETON_COUNT }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        ) : null}
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
        {isSearching &&
        !isResultsLoading &&
        propertyItems.length === 0 &&
        !isPending &&
        !isFetching ? (
          <CommandEmpty>No results found.</CommandEmpty>
        ) : null}
        {propertyItems.length > 0 ? (
          <>
            {navigationItems.length > 0 || recentItems.length > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={propertiesGroupHeading ?? "Properties"}>
              {propertyItems.map((item) => (
                <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={item.value}>
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    );
  }
);
WorkspaceCommandResults.displayName = "WorkspaceCommandResults";
