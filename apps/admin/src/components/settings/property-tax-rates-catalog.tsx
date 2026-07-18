import { memo, type MouseEvent, useState } from "react";

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

export const PropertyTaxRatesCatalog = memo(function PropertyTaxRatesCatalog({
  description,
  disabled = false,
  isPending = false,
  isQuickDeleteActive,
  onDeleteRow,
  onUpsertRow,
  taxRates,
}: TPropertyTaxRatesCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogRow, setDialogRow] = useState<PropertyTaxRateFormRow | null | undefined>(undefined);

  const filtered = taxRates.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const showSearch = taxRates.length > PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD;
  const dialogOpen = dialogRow !== undefined;

  return (
    <>
      <PropertySettingsCatalogList
        addLabel="Add tax"
        count={taxRates.length}
        description={description}
        disabled={disabled || isPending}
        emptyLabel="No taxes configured."
        onAdd={() => setDialogRow(null)}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        showSearch={showSearch}
        title="Tax rates"
      >
        {filtered.map((row) => (
          <PropertySettingsCatalogRow
            disabled={disabled}
            isDeletePending={isPending}
            key={row.clientId}
            meta={`${row.ratePercent}%`}
            onDelete={(event) => onDeleteRow(row, event)}
            onEdit={() => setDialogRow(row)}
            quickDeleteActive={isQuickDeleteActive}
            title={row.name}
          />
        ))}
      </PropertySettingsCatalogList>
      <PropertyTaxRateDialog
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
PropertyTaxRatesCatalog.displayName = "PropertyTaxRatesCatalog";
