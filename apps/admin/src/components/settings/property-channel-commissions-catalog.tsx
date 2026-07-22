import { memo, type MouseEvent, useCallback, useState } from "react";

import { PropertyChannelCommissionDialog } from "@/components/settings/property-channel-commission-dialog";
import { usePropertySettingsCatalogDialog } from "@/components/settings/property-settings-catalog-dialog-context";
import { PropertySettingsCatalogDialogScope } from "@/components/settings/property-settings-catalog-dialog-scope";
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

const ChannelCommissionCatalogRow = memo(function ChannelCommissionCatalogRow({
  disabled,
  isPending,
  isQuickDeleteActive,
  onDeleteRow,
  row,
}: {
  disabled: boolean;
  isPending: boolean;
  isQuickDeleteActive: boolean;
  onDeleteRow: TPropertyChannelCommissionsCatalogProps["onDeleteRow"];
  row: PropertyChannelCommissionFormRow;
}) {
  const { openEdit } = usePropertySettingsCatalogDialog<PropertyChannelCommissionFormRow>();

  return (
    <PropertySettingsCatalogRow
      disabled={disabled}
      isDeletePending={isPending}
      meta={channelMeta(row)}
      onDelete={(event) => onDeleteRow(row, event)}
      onEdit={() => openEdit(row)}
      quickDeleteActive={isQuickDeleteActive}
      title={row.name}
    />
  );
});
ChannelCommissionCatalogRow.displayName = "ChannelCommissionCatalogRow";

const ChannelCommissionsCatalogList = memo(function ChannelCommissionsCatalogList({
  channelCommissions,
  disabled,
  isPending,
  isQuickDeleteActive,
  onDeleteRow,
}: Omit<TPropertyChannelCommissionsCatalogProps, "onUpsertRow">) {
  const [searchQuery, setSearchQuery] = useState("");
  const { openAdd } = usePropertySettingsCatalogDialog<PropertyChannelCommissionFormRow>();

  const filtered = channelCommissions.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const showSearch = channelCommissions.length > PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD;

  return (
    <PropertySettingsCatalogList
      addLabel="Add channel"
      count={channelCommissions.length}
      description="Booking channels available when adding stays. Rules match each channel’s commission base and payout treatment."
      disabled={disabled || isPending}
      emptyLabel="No channels configured."
      onAdd={openAdd}
      onSearchChange={setSearchQuery}
      searchQuery={searchQuery}
      showSearch={showSearch}
      title="Channel commissions"
    >
      {filtered.map((row) => (
        <ChannelCommissionCatalogRow
          disabled={disabled ?? false}
          isPending={isPending ?? false}
          isQuickDeleteActive={isQuickDeleteActive}
          key={row.clientId}
          onDeleteRow={onDeleteRow}
          row={row}
        />
      ))}
    </PropertySettingsCatalogList>
  );
});
ChannelCommissionsCatalogList.displayName = "ChannelCommissionsCatalogList";

export const PropertyChannelCommissionsCatalog = memo(function PropertyChannelCommissionsCatalog({
  channelCommissions,
  disabled = false,
  isPending = false,
  isQuickDeleteActive,
  onDeleteRow,
  onUpsertRow,
}: TPropertyChannelCommissionsCatalogProps) {
  const renderDialog = useCallback(
    (props: {
      isPending: boolean;
      onOpenChange: (open: boolean) => void;
      onSubmit: (row: PropertyChannelCommissionFormRow) => void;
      open: boolean;
      row: PropertyChannelCommissionFormRow | null;
    }) => <PropertyChannelCommissionDialog {...props} />,
    []
  );

  return (
    <PropertySettingsCatalogDialogScope
      isPending={isPending}
      onUpsertRow={onUpsertRow}
      renderDialog={renderDialog}
    >
      <ChannelCommissionsCatalogList
        channelCommissions={channelCommissions}
        disabled={disabled}
        isPending={isPending}
        isQuickDeleteActive={isQuickDeleteActive}
        onDeleteRow={onDeleteRow}
      />
    </PropertySettingsCatalogDialogScope>
  );
});
PropertyChannelCommissionsCatalog.displayName = "PropertyChannelCommissionsCatalog";
