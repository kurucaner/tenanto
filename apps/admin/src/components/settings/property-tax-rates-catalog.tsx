import { memo, type MouseEvent, useCallback, useState } from "react";

import { usePropertySettingsCatalogDialog } from "@/components/settings/property-settings-catalog-dialog-context";
import { PropertySettingsCatalogDialogScope } from "@/components/settings/property-settings-catalog-dialog-scope";
import { PropertySettingsCatalogList } from "@/components/settings/property-settings-catalog-list";
import { PropertySettingsCatalogRow } from "@/components/settings/property-settings-catalog-row";
import { PropertyTaxRateDialog } from "@/components/settings/property-tax-rate-dialog";
import {
  PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD,
  type PropertyTaxRateFormRow,
} from "@/lib/property-settings-form-types";

type TPropertyTaxRatesCatalogProps = {
  description: string;
  disabled?: boolean;
  isPending?: boolean;
  isQuickDeleteActive: boolean;
  onDeleteRow: (row: PropertyTaxRateFormRow, event?: MouseEvent<HTMLButtonElement>) => void;
  onUpsertRow: (row: PropertyTaxRateFormRow) => void;
  taxRates: PropertyTaxRateFormRow[];
};

interface TaxRateCatalogRowProps {
  disabled: boolean;
  isPending: boolean;
  isQuickDeleteActive: boolean;
  onDeleteRow: TPropertyTaxRatesCatalogProps["onDeleteRow"];
  row: PropertyTaxRateFormRow;
}

const TaxRateCatalogRow = memo(function TaxRateCatalogRow({
  disabled,
  isPending,
  isQuickDeleteActive,
  onDeleteRow,
  row,
}: TaxRateCatalogRowProps) {
  const { openEdit } = usePropertySettingsCatalogDialog<PropertyTaxRateFormRow>();

  return (
    <PropertySettingsCatalogRow
      disabled={disabled}
      isDeletePending={isPending}
      meta={`${row.ratePercent}%`}
      onDelete={(event) => onDeleteRow(row, event)}
      onEdit={() => openEdit(row)}
      quickDeleteActive={isQuickDeleteActive}
      title={row.name}
    />
  );
});
TaxRateCatalogRow.displayName = "TaxRateCatalogRow";

const TaxRatesCatalogList = memo(function TaxRatesCatalogList({
  description,
  disabled,
  isPending,
  isQuickDeleteActive,
  onDeleteRow,
  taxRates,
}: Omit<TPropertyTaxRatesCatalogProps, "onUpsertRow">) {
  const [searchQuery, setSearchQuery] = useState("");
  const { openAdd } = usePropertySettingsCatalogDialog<PropertyTaxRateFormRow>();

  const filtered = taxRates.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const showSearch = taxRates.length > PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD;

  return (
    <PropertySettingsCatalogList
      addLabel="Add tax"
      count={taxRates.length}
      description={description}
      disabled={disabled || isPending}
      emptyLabel="No taxes configured."
      onAdd={openAdd}
      onSearchChange={setSearchQuery}
      searchQuery={searchQuery}
      showSearch={showSearch}
      title="Tax rates"
    >
      {filtered.map((row) => (
        <TaxRateCatalogRow
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
TaxRatesCatalogList.displayName = "TaxRatesCatalogList";

export const PropertyTaxRatesCatalog = memo(function PropertyTaxRatesCatalog({
  description,
  disabled = false,
  isPending = false,
  isQuickDeleteActive,
  onDeleteRow,
  onUpsertRow,
  taxRates,
}: TPropertyTaxRatesCatalogProps) {
  const renderDialog = useCallback(
    (props: {
      isPending: boolean;
      onOpenChange: (open: boolean) => void;
      onSubmit: (row: PropertyTaxRateFormRow) => void;
      open: boolean;
      row: PropertyTaxRateFormRow | null;
    }) => <PropertyTaxRateDialog {...props} />,
    []
  );

  return (
    <PropertySettingsCatalogDialogScope
      isPending={isPending}
      onUpsertRow={onUpsertRow}
      renderDialog={renderDialog}
    >
      <TaxRatesCatalogList
        description={description}
        disabled={disabled}
        isPending={isPending}
        isQuickDeleteActive={isQuickDeleteActive}
        onDeleteRow={onDeleteRow}
        taxRates={taxRates}
      />
    </PropertySettingsCatalogDialogScope>
  );
});
PropertyTaxRatesCatalog.displayName = "PropertyTaxRatesCatalog";
