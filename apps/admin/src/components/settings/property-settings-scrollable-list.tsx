import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PropertySettingsScrollableListProps {
  children: ReactNode;
  header: ReactNode;
  headerClassName: string;
}

export const PropertySettingsScrollableList = memo(
  ({ children, header, headerClassName }: PropertySettingsScrollableListProps) => {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div
          className={cn(
            "sticky top-0 z-10 grid items-center gap-3 border-b bg-card px-3 py-2",
            headerClassName
          )}
        >
          {header}
        </div>
        <ul className="max-h-[min(20rem,40vh)] divide-y overflow-y-auto overscroll-y-contain">
          {children}
        </ul>
      </div>
    );
  }
);
PropertySettingsScrollableList.displayName = "PropertySettingsScrollableList";
