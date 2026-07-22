import { memo, type MouseEvent, useCallback, useState } from "react";

import { PropertyIncomeLineTypeDialog } from "@/components/settings/property-income-line-type-dialog";
import { usePropertySettingsCatalogDialog } from "@/components/settings/property-settings-catalog-dialog-context";
import { PropertySettingsCatalogDialogScope } from "@/components/settings/property-settings-catalog-dialog-scope";
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

const IncomeLineTypeCatalogRow = memo(function IncomeLineTypeCatalogRow({
  disabled,
  isPending,
  isQuickDeleteActive,
  onDeleteRow,
  row,
}: {
  disabled: boolean;
  isPending: boolean;
  isQuickDeleteActive: boolean;
  onDeleteRow: TPropertyIncomeLineTypesCatalogProps["onDeleteRow"];
  row: PropertyIncomeLineTypeFormRow;
}) {
  const { openEdit } = usePropertySettingsCatalogDialog<PropertyIncomeLineTypeFormRow>();

  return (
    <PropertySettingsCatalogRow
      disabled={disabled}
      isDeletePending={isPending}
      onDelete={(event) => onDeleteRow(row, event)}
      onEdit={() => openEdit(row)}
      quickDeleteActive={isQuickDeleteActive}
      title={row.name}
    />
  );
});
IncomeLineTypeCatalogRow.displayName = "IncomeLineTypeCatalogRow";

const IncomeLineTypesCatalogList = memo(function IncomeLineTypesCatalogList({
  disabled,
  incomeLineTypes,
  isPending,
  isQuickDeleteActive,
  onDeleteRow,
}: Omit<TPropertyIncomeLineTypesCatalogProps, "onUpsertRow">) {
  const [searchQuery, setSearchQuery] = useState("");
  const { openAdd } = usePropertySettingsCatalogDialog<PropertyIncomeLineTypeFormRow>();

  const filtered = incomeLineTypes.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const showSearch = incomeLineTypes.length > PROPERTY_SETTINGS_CATALOG_SEARCH_THRESHOLD;

  return (
    <PropertySettingsCatalogList
      addLabel="Add income type"
      count={incomeLineTypes.length}
      description="Types available when adding other income and filtering the income table."
      disabled={disabled || isPending}
      emptyLabel="No other income types configured."
      onAdd={openAdd}
      onSearchChange={setSearchQuery}
      searchQuery={searchQuery}
      showSearch={showSearch}
      title="Other income types"
    >
      {filtered.map((row) => (
        <IncomeLineTypeCatalogRow
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
IncomeLineTypesCatalogList.displayName = "IncomeLineTypesCatalogList";

export const PropertyIncomeLineTypesCatalog = memo(function PropertyIncomeLineTypesCatalog({
  disabled = false,
  incomeLineTypes,
  isPending = false,
  isQuickDeleteActive,
  onDeleteRow,
  onUpsertRow,
}: TPropertyIncomeLineTypesCatalogProps) {
  const renderDialog = useCallback(
    (props: {
      isPending: boolean;
      onOpenChange: (open: boolean) => void;
      onSubmit: (row: PropertyIncomeLineTypeFormRow) => void;
      open: boolean;
      row: PropertyIncomeLineTypeFormRow | null;
    }) => <PropertyIncomeLineTypeDialog {...props} />,
    []
  );

  return (
    <PropertySettingsCatalogDialogScope
      isPending={isPending}
      onUpsertRow={onUpsertRow}
      renderDialog={renderDialog}
    >
      <IncomeLineTypesCatalogList
        disabled={disabled}
        incomeLineTypes={incomeLineTypes}
        isPending={isPending}
        isQuickDeleteActive={isQuickDeleteActive}
        onDeleteRow={onDeleteRow}
      />
    </PropertySettingsCatalogDialogScope>
  );
});
PropertyIncomeLineTypesCatalog.displayName = "PropertyIncomeLineTypesCatalog";
