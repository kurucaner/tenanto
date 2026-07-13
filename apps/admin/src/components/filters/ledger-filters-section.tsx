import { memo, type ReactNode } from "react";

import { SearchFilterField } from "@/components/filters/search-filter-field";

export interface ILedgerFiltersSearchConfig {
  className?: string;
  id: string;
  label?: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

interface LedgerFiltersSectionProps {
  children?: ReactNode;
  footer?: ReactNode;
  search?: ILedgerFiltersSearchConfig;
}

export const LedgerFiltersSection = memo(
  ({ children, footer, search }: LedgerFiltersSectionProps) => (
    <div className="space-y-3 px-4 pt-4">
      {search ? (
        <SearchFilterField
          className={search.className}
          id={search.id}
          label={search.label}
          onChange={search.onChange}
          placeholder={search.placeholder}
          value={search.value}
        />
      ) : null}
      {children}
      {footer}
    </div>
  )
);
LedgerFiltersSection.displayName = "LedgerFiltersSection";
