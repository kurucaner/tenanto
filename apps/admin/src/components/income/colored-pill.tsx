import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ColoredPillProps {
  children: ReactNode;
  className: string;
}

export const ColoredPill = memo(({ children, className }: ColoredPillProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      className
    )}
  >
    {children}
  </span>
));
ColoredPill.displayName = "ColoredPill";
