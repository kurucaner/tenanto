import { memo, type MouseEvent, useCallback, useState } from "react";

import { PropertyExpenseCategoryDialog } from "@/components/settings/property-expense-category-dialog";
import { usePropertySettingsCatalogDialog } from "@/components/settings/property-settings-catalog-dialog-context";
import { PropertySettingsCatalogDialogScope } from "@/components/settings/property-settings-catalog-dialog-scope";
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

const ExpenseCategoryCatalogRow = memo(function ExpenseCategoryCatalogRow({
  disabled,
  isPending,
  isQuickDeleteActive,
  onDeleteRow,
  row,
}: {
  disabled: boolean;
  isPending: boolean;
  isQuickDeleteActive: boolean;
  onDeleteRow: TPropertyExpenseCategoriesCatalogProps["onDeleteRow"];
  row: PropertyExpenseCategoryTypeFormRow;
}) {
  const { openEdit } = usePropertySettingsCatalogDialog<PropertyExpenseCategoryTypeFormRow>();
  const isSystem = row.isSystem === true;
  const metaParts = [...(row.isAnnualAmount ? ["Annual"] : []), ...(isSystem ? ["System"] : [])];

  return (
    <PropertySettingsCatalogRow
      disabled={disabled}
      isDeletePending={isPending}
      meta={metaParts.length > 0 ? metaParts.join(" · ") : undefined}
      onDelete={isSystem ? undefined : (event) => onDeleteRow(row, event)}
      onEdit={isSystem ? undefined : () => openEdit(row)}
      quickDeleteActive={isQuickDeleteActive}
      showDelete={!isSystem}
      showEdit={!isSystem}
      title={row.name}
    />
  );
});
ExpenseCategoryCatalogRow.displayName = "ExpenseCategoryCatalogRow";

const ExpenseCategoriesCatalogList = memo(function ExpenseCategoriesCatalogList({
  disabled,
  expenseCategoryTypes,
  isPending,
  isQuickDeleteActive,
  onDeleteRow,
}: Omit<TPropertyExpenseCategoriesCatalogProps, "onUpsertRow">) {
  const [searchQuery, setSearchQuery] = useState("");
  const { openAdd } = usePropertySettingsCatalogDialog<PropertyExpenseCategoryTypeFormRow>();

  const filtered = expenseCategoryTypes.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const showSearch = expenseCategoryTypes.length > PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD;

  return (
    <PropertySettingsCatalogList
      addLabel="Add category"
      count={expenseCategoryTypes.length}
      description="Categories available when adding expenses. Annual categories are spread across months in reports."
      disabled={disabled || isPending}
      emptyLabel="No expense categories configured."
      onAdd={openAdd}
      onSearchChange={setSearchQuery}
      searchQuery={searchQuery}
      showSearch={showSearch}
      title="Expense categories"
    >
      {filtered.map((row) => (
        <ExpenseCategoryCatalogRow
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
ExpenseCategoriesCatalogList.displayName = "ExpenseCategoriesCatalogList";

export const PropertyExpenseCategoriesCatalog = memo(function PropertyExpenseCategoriesCatalog({
  disabled = false,
  expenseCategoryTypes,
  isPending = false,
  isQuickDeleteActive,
  onDeleteRow,
  onUpsertRow,
}: TPropertyExpenseCategoriesCatalogProps) {
  const renderDialog = useCallback(
    (props: {
      isPending: boolean;
      onOpenChange: (open: boolean) => void;
      onSubmit: (row: PropertyExpenseCategoryTypeFormRow) => void;
      open: boolean;
      row: PropertyExpenseCategoryTypeFormRow | null;
    }) => <PropertyExpenseCategoryDialog {...props} />,
    []
  );

  return (
    <PropertySettingsCatalogDialogScope
      isPending={isPending}
      onUpsertRow={onUpsertRow}
      renderDialog={renderDialog}
    >
      <ExpenseCategoriesCatalogList
        disabled={disabled}
        expenseCategoryTypes={expenseCategoryTypes}
        isPending={isPending}
        isQuickDeleteActive={isQuickDeleteActive}
        onDeleteRow={onDeleteRow}
      />
    </PropertySettingsCatalogDialogScope>
  );
});
PropertyExpenseCategoriesCatalog.displayName = "PropertyExpenseCategoriesCatalog";
