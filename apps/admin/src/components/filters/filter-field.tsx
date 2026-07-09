import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const FilterField = memo(
  ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={cn("min-w-0 space-y-1.5", className)}>{children}</div>
  )
);
FilterField.displayName = "FilterField";
