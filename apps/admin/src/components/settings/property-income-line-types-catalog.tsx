import { memo, type MouseEvent, useState } from "react";

import { PropertyIncomeLineTypeDialog } from "@/components/settings/property-income-line-type-dialog";
import { PropertySettingsCatalogList } from "@/components/settings/property-settings-catalog-list";
import { PropertySettingsCatalogRow } from "@/components/settings/property-settings-catalog-row";
import {
  PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD,
  type PropertyIncomeLineTypeFormRow,
} from "@/lib/property-settings-form-types";

type TPropertyIncomeLineTypesCatalogProps = {
  disabled?: boolean;
  incomeLineTypes: PropertyIncomeLineTypeFormRow[];
  isPending?: boolean;
  isQuickDeleteActive: boolean;
  onDeleteRow: (row: PropertyIncomeLineTypeFormRow, event?: MouseEvent<HTMLButtonElement>) => void;
  onUpsertRow: (row: PropertyIncomeLineTypeFormRow) => void;
};

export const PropertyIncomeLineTypesCatalog = memo(function PropertyIncomeLineTypesCatalog({
  disabled = false,
  incomeLineTypes,
  isPending = false,
  isQuickDeleteActive,
  onDeleteRow,
  onUpsertRow,
}: TPropertyIncomeLineTypesCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogRow, setDialogRow] = useState<PropertyIncomeLineTypeFormRow | null | undefined>(
    undefined
  );

  const filtered = incomeLineTypes.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const showSearch = incomeLineTypes.length > PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD;
  const dialogOpen = dialogRow !== undefined;

  return (
    <>
      <PropertySettingsCatalogList
        addLabel="Add income type"
        count={incomeLineTypes.length}
        description="Types available when adding other income and filtering the income table."
        disabled={disabled || isPending}
        emptyLabel="No other income types configured."
        onAdd={() => setDialogRow(null)}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        showSearch={showSearch}
        title="Other income types"
      >
        {filtered.map((row) => (
          <PropertySettingsCatalogRow
            disabled={disabled}
            isDeletePending={isPending}
            key={row.clientId}
            onDelete={(event) => onDeleteRow(row, event)}
            onEdit={() => setDialogRow(row)}
            quickDeleteActive={isQuickDeleteActive}
            title={row.name}
          />
        ))}
      </PropertySettingsCatalogList>
      <PropertyIncomeLineTypeDialog
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
PropertyIncomeLineTypesCatalog.displayName = "PropertyIncomeLineTypesCatalog";
