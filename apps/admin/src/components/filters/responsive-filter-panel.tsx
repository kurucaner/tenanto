import { memo, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface ResponsiveFilterPanelProps {
  children: ReactNode;
  description?: string;
  title: string;
  trigger: ReactNode;
}

export const ResponsiveFilterPanel = memo(
  ({ children, description, title, trigger }: ResponsiveFilterPanelProps) => {
    const isMobile = useIsMobile();

    if (isMobile) {
      return (
        <Sheet>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent className="max-h-[85svh] overflow-y-auto rounded-t-xl" side="bottom">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </SheetHeader>
            <div className="px-4 pb-4">{children}</div>
          </SheetContent>
        </Sheet>
      );
    }

    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-80 p-4">
          <div className="mb-3">
            <h3 className="font-heading text-sm font-medium">{title}</h3>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {children}
        </PopoverContent>
      </Popover>
    );
  }
);
ResponsiveFilterPanel.displayName = "ResponsiveFilterPanel";
