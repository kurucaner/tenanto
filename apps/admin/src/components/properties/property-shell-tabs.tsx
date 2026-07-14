import { Check, ChevronDown } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { type IPropertyShellTab } from "@/config/property-shell-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePropertyShell } from "@/hooks/use-property-shell";
import {
  buildPropertyShellTabPath,
  resolveActivePropertyShellTab,
} from "@/lib/property-shell-tab-navigation";
import { getVisiblePropertyShellTabs } from "@/lib/property-shell-tab-visibility";
import { cn } from "@/lib/utils";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 px-3 pb-2 text-sm font-medium transition-colors ${
    isActive
      ? "border-b-2 border-foreground text-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;

interface PropertyShellTabOptionProps {
  isSelected: boolean;
  onSelect: (tab: IPropertyShellTab) => void;
  tab: IPropertyShellTab;
}

const PropertyShellTabOption = memo(
  ({ isSelected, onSelect, tab }: PropertyShellTabOptionProps) => (
    <button
      aria-pressed={isSelected}
      className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onSelect(tab)}
      type="button"
    >
      <Check
        aria-hidden
        className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
      />
      <span className="truncate font-medium">{tab.label}</span>
    </button>
  )
);
PropertyShellTabOption.displayName = "PropertyShellTabOption";

const PropertyShellDesktopTabs = memo(
  ({ propertyId, tabs }: { propertyId: string; tabs: IPropertyShellTab[] }) => (
    <div className="-mx-1 px-1">
      <div className="flex flex-wrap items-center gap-1 border-b">
        {tabs.map((tab) => (
          <NavLink
            className={tabClass}
            end={tab.end}
            key={tab.path || "overview"}
            to={buildPropertyShellTabPath(propertyId, tab)}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
);
PropertyShellDesktopTabs.displayName = "PropertyShellDesktopTabs";

const PropertyShellMobileTabs = memo(
  ({ propertyId, tabs }: { propertyId: string; tabs: IPropertyShellTab[] }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const activeTab = useMemo(
      () => resolveActivePropertyShellTab(pathname, propertyId, tabs),
      [pathname, propertyId, tabs]
    );

    const handleSelect = useCallback(
      (tab: IPropertyShellTab) => {
        navigate(buildPropertyShellTabPath(propertyId, tab));
        setOpen(false);
      },
      [navigate, propertyId]
    );

    return (
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger asChild>
          <Button className="w-full justify-between" type="button" variant="outline">
            <span>{activeTab.label}</span>
            <ChevronDown />
          </Button>
        </SheetTrigger>
        <SheetContent className="max-h-[85svh] overflow-y-auto rounded-t-xl" side="bottom">
          <SheetHeader>
            <SheetTitle>Section</SheetTitle>
            <SheetDescription>Choose a property section.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {tabs.map((tab) => (
              <PropertyShellTabOption
                isSelected={tab.path === activeTab.path}
                key={tab.path || "overview"}
                onSelect={handleSelect}
                tab={tab}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);
PropertyShellMobileTabs.displayName = "PropertyShellMobileTabs";

export const PropertyShellTabs = memo(({ propertyId }: { propertyId: string }) => {
  const isMobile = useIsMobile();
  const { permissions } = usePropertyShell();
  const tabs = getVisiblePropertyShellTabs(permissions);

  if (isMobile) {
    return <PropertyShellMobileTabs propertyId={propertyId} tabs={tabs} />;
  }

  return <PropertyShellDesktopTabs propertyId={propertyId} tabs={tabs} />;
});
PropertyShellTabs.displayName = "PropertyShellTabs";
