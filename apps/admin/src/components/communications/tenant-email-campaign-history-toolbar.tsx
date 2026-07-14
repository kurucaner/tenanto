import { memo } from "react";

import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { SearchFilterField } from "@/components/filters/search-filter-field";

interface ITenantEmailCampaignHistoryToolbarProps {
  activeSearchLabel?: string;
  countLabel?: string;
  onClearSearch: () => void;
  onSearchInputChange: (value: string) => void;
  searchInput: string;
}

export const TenantEmailCampaignHistoryToolbar = memo(
  ({
    activeSearchLabel,
    countLabel,
    onClearSearch,
    onSearchInputChange,
    searchInput,
  }: ITenantEmailCampaignHistoryToolbarProps) => {
    const activeFilters: IDataTableActiveFilter[] = activeSearchLabel
      ? [{ id: "q", label: activeSearchLabel, onRemove: onClearSearch }]
      : [];

    return (
      <DataTableToolbar
        activeFilters={
          activeFilters.length > 0 ? (
            <DataTableActiveFilters filters={activeFilters} onClearAll={onClearSearch} />
          ) : undefined
        }
        countLabel={countLabel}
        search={
          <SearchFilterField
            id="tenant-email-campaign-history-search"
            onChange={onSearchInputChange}
            placeholder="Search by subject…"
            value={searchInput}
          />
        }
      />
    );
  }
);
TenantEmailCampaignHistoryToolbar.displayName = "TenantEmailCampaignHistoryToolbar";
