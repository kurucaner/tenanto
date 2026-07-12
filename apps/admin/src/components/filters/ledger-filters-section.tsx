import { memo, type ReactNode } from "react";

export const LedgerFiltersSection = memo(
  ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
    <div className="space-y-3 px-4 pt-4">
      {children}
      {footer}
    </div>
  )
);
LedgerFiltersSection.displayName = "LedgerFiltersSection";
