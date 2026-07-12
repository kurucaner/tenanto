import { memo, type ReactNode } from "react";

import { getLedgerFiltersGridClass } from "@/lib/ledger-filter-grid";

export const LedgerFilterGrid = memo(
  ({ children, filterCount }: { children: ReactNode; filterCount: number }) => (
    <div className={getLedgerFiltersGridClass(filterCount)}>{children}</div>
  )
);
LedgerFilterGrid.displayName = "LedgerFilterGrid";
