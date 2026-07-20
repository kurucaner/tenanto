import { memo, type MouseEvent, useState } from "react";

import { PropertyChannelCommissionDialog } from "@/components/settings/property-channel-commission-dialog";
import { PropertySettingsCatalogList } from "@/components/settings/property-settings-catalog-list";
import { PropertySettingsCatalogRow } from "@/components/settings/property-settings-catalog-row";
import {
  PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD,
  type PropertyChannelCommissionFormRow,
} from "@/lib/property-settings-form-types";

function channelMeta(row: PropertyChannelCommissionFormRow): string {
  const parts = [`${row.ratePercent}%`];
  if (row.excludeCleaningFromCommissionBase) {
    parts.push("Excludes cleaning");
  }
  if (row.excludeResortTaxFromPayout) {
    parts.push("Excludes resort tax");
  }
  return parts.join(" · ");
}

type TPropertyChannelCommissionsCatalogProps = {
  channelCommissions: PropertyChannelCommissionFormRow[];
  disabled?: boolean;
  isPending?: boolean;
  isQuickDeleteActive: boolean;
  onDeleteRow: (
    row: PropertyChannelCommissionFormRow,
    event?: MouseEvent<HTMLButtonElement>
  ) => void;
  onUpsertRow: (row: PropertyChannelCommissionFormRow) => void;
};

export const PropertyChannelCommissionsCatalog = memo(function PropertyChannelCommissionsCatalog({
  channelCommissions,
  disabled = false,
  isPending = false,
  isQuickDeleteActive,
  onDeleteRow,
  onUpsertRow,
}: TPropertyChannelCommissionsCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogRow, setDialogRow] = useState<PropertyChannelCommissionFormRow | null | undefined>(
    undefined
  );

  const filtered = channelCommissions.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const showSearch = channelCommissions.length > PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD;
  const dialogOpen = dialogRow !== undefined;

  return (
    <>
      <PropertySettingsCatalogList
        addLabel="Add channel"
        count={channelCommissions.length}
        description="Booking channels available when adding stays. Rules match each channel’s commission base and payout treatment."
        disabled={disabled || isPending}
        emptyLabel="No channels configured."
        onAdd={() => setDialogRow(null)}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        showSearch={showSearch}
        title="Channel commissions"
      >
        {filtered.map((row) => (
          <PropertySettingsCatalogRow
            disabled={disabled}
            isDeletePending={isPending}
            key={row.clientId}
            meta={channelMeta(row)}
            onDelete={(event) => onDeleteRow(row, event)}
            onEdit={() => setDialogRow(row)}
            quickDeleteActive={isQuickDeleteActive}
            title={row.name}
          />
        ))}
      </PropertySettingsCatalogList>
      <PropertyChannelCommissionDialog
        isPending={isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDialogRow(undefined);
          }
        }}
        onSubmit={(row) => {
          onUpsertRow(row);
          setDialogRow(undefined);
        }}
        open={dialogOpen}
        row={dialogRow ?? null}
      />
    </>
  );
});
PropertyChannelCommissionsCatalog.displayName = "PropertyChannelCommissionsCatalog";
