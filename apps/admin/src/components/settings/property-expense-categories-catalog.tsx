import { memo, type MouseEvent, useState } from "react";

import { PropertyExpenseCategoryDialog } from "@/components/settings/property-expense-category-dialog";
import { PropertySettingsCatalogList } from "@/components/settings/property-settings-catalog-list";
import { PropertySettingsCatalogRow } from "@/components/settings/property-settings-catalog-row";
import {
  PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD,
  type PropertyExpenseCategoryTypeFormRow,
} from "@/lib/property-settings-form-types";

type TPropertyExpenseCategoriesCatalogProps = {
  disabled?: boolean;
  expenseCategoryTypes: PropertyExpenseCategoryTypeFormRow[];
  isPending?: boolean;
  isQuickDeleteActive: boolean;
  onDeleteRow: (
    row: PropertyExpenseCategoryTypeFormRow,
    event?: MouseEvent<HTMLButtonElement>
  ) => void;
  onUpsertRow: (row: PropertyExpenseCategoryTypeFormRow) => void;
};

export const PropertyExpenseCategoriesCatalog = memo(function PropertyExpenseCategoriesCatalog({
  disabled = false,
  expenseCategoryTypes,
  isPending = false,
  isQuickDeleteActive,
  onDeleteRow,
  onUpsertRow,
}: TPropertyExpenseCategoriesCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogRow, setDialogRow] = useState<
    PropertyExpenseCategoryTypeFormRow | null | undefined
  >(undefined);

  const filtered = expenseCategoryTypes.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const showSearch = expenseCategoryTypes.length > PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD;
  const dialogOpen = dialogRow !== undefined;

  return (
    <>
      <PropertySettingsCatalogList
        addLabel="Add category"
        count={expenseCategoryTypes.length}
        description="Categories available when adding expenses. Annual categories are spread across months in reports."
        disabled={disabled || isPending}
        emptyLabel="No expense categories configured."
        onAdd={() => setDialogRow(null)}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        showSearch={showSearch}
        title="Expense categories"
      >
        {filtered.map((row) => (
          <PropertySettingsCatalogRow
            disabled={disabled}
            isDeletePending={isPending}
            key={row.clientId}
            meta={row.isAnnualAmount ? "Annual" : undefined}
            onDelete={(event) => onDeleteRow(row, event)}
            onEdit={() => setDialogRow(row)}
            quickDeleteActive={isQuickDeleteActive}
            title={row.name}
          />
        ))}
      </PropertySettingsCatalogList>
      <PropertyExpenseCategoryDialog
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
PropertyExpenseCategoriesCatalog.displayName = "PropertyExpenseCategoriesCatalog";
