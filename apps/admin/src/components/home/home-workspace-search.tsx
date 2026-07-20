import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { WorkspaceCommandResults } from "@/components/home/workspace-command-results";
import { Command, CommandInput } from "@/components/ui/command";
import { useHomeSearchFocus } from "@/contexts/home-search-focus-context";
import { useWorkspaceCommandSearch } from "@/hooks/use-workspace-command-search";
import { cn } from "@/lib/utils";

function isMacPlatform(): boolean {
  if (globalThis.navigator === undefined) {
    return true;
  }

  return /Mac|iPhone|iPad|iPod/.test(globalThis.navigator.platform);
}

interface HomeWorkspaceSearchProps {
  onActiveChange: (active: boolean) => void;
}

export const HomeWorkspaceSearch = memo(({ onActiveChange }: HomeWorkspaceSearchProps) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const homeSearchFocus = useHomeSearchFocus();
  const [isFocused, setIsFocused] = useState(false);
  const searchState = useWorkspaceCommandSearch({ enabled: true });
  const isMac = isMacPlatform();

  const isActive = isFocused || searchState.search.length > 0;

  useEffect(() => {
    onActiveChange(isActive);
  }, [isActive, onActiveChange]);

  useEffect(() => {
    homeSearchFocus?.registerFocusHandler(() => {
      const input = containerRef.current?.querySelector("input");
      input?.focus();
    });

    return () => {
      homeSearchFocus?.registerFocusHandler(null);
    };
  }, [homeSearchFocus]);

  const handleSelect = (path: string) => {
    searchState.resetSearch();
    setIsFocused(false);
    const input = containerRef.current?.querySelector("input");
    input?.blur();
    navigate(path);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape" || searchState.search.length > 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.blur();
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <Command
        className="overflow-visible rounded-xl border border-border/80 bg-card/50 shadow-sm **:data-[slot=command-input-wrapper]:border-0 **:data-[slot=command-input-wrapper]:px-3"
        shouldFilter={false}
      >
        <div className="relative">
          <CommandInput
            className="h-11 pe-16"
            onBlur={() => setIsFocused(false)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleInputKeyDown}
            onValueChange={searchState.setSearch}
            placeholder="Search"
            value={searchState.search}
          />
          <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center gap-1">
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/80 bg-muted/50 px-1 text-[10px] font-medium text-muted-foreground">
              {isMac ? "⌘" : "Ctrl"}
            </kbd>
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/80 bg-muted/50 px-1 text-[10px] font-medium text-muted-foreground">
              K
            </kbd>
          </div>
        </div>

        {isActive ? (
          <div
            className={cn(
              "absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-border/80 bg-popover shadow-lg",
              "animate-in fade-in slide-in-from-top-1 duration-150"
            )}
          >
            <WorkspaceCommandResults
              hasResults={searchState.hasResults}
              isPending={searchState.isPending}
              isSearching={searchState.isSearching}
              navigationItems={searchState.navigationItems}
              onSelect={handleSelect}
              propertyItems={searchState.propertyItems}
              recentItems={searchState.recentItems}
              searchTips={searchState.searchTips}
            />
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-border/80 px-1">↑</kbd>
                <kbd className="rounded border border-border/80 px-1">↓</kbd>
                to navigate
              </span>
              <span className="mx-2">·</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-border/80 px-1">↵</kbd>
                to select
              </span>
            </div>
          </div>
        ) : null}
      </Command>
    </div>
  );
});
HomeWorkspaceSearch.displayName = "HomeWorkspaceSearch";
