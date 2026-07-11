import { memo, type MouseEvent } from "react";

import { PropertySettingsListFooter } from "@/components/settings/property-settings-list-footer";
import { PropertySettingsScrollableList } from "@/components/settings/property-settings-scrollable-list";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export interface PropertyExpenseCategoryTypeFormRow {
  clientId: string;
  id?: string;
  isAnnualAmount: boolean;
  name: string;
}

export interface PropertyExpenseCategoryTypesEditorProps {
  disabled?: boolean;
  expenseCategoryTypes: PropertyExpenseCategoryTypeFormRow[];
  isQuickDeleteActive: boolean;
  isSavingExpenses?: boolean;
  onChange: (expenseCategoryTypes: PropertyExpenseCategoryTypeFormRow[]) => void;
  onDeleteRow: (
    row: PropertyExpenseCategoryTypeFormRow,
    event?: MouseEvent<HTMLButtonElement>
  ) => void;
  onSaveExpenses?: () => void;
  showSaveExpenses?: boolean;
}

function createClientId(): string {
  return crypto.randomUUID();
}

export const PropertyExpenseCategoryTypesEditor = memo(
  ({
    disabled = false,
    expenseCategoryTypes,
    isQuickDeleteActive,
    isSavingExpenses = false,
    onChange,
    onDeleteRow,
    onSaveExpenses,
    showSaveExpenses = false,
  }: PropertyExpenseCategoryTypesEditorProps) => {
    const updateRow = (clientId: string, patch: Partial<PropertyExpenseCategoryTypeFormRow>) => {
      onChange(
        expenseCategoryTypes.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
      );
    };

    const addRow = () => {
      onChange([
        ...expenseCategoryTypes,
        { clientId: createClientId(), isAnnualAmount: false, name: "" },
      ]);
    };

    return (
      <div className="space-y-3">
        {expenseCategoryTypes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No expense categories configured.</p>
        ) : (
          <PropertySettingsScrollableList
            header={
              <>
                <span className="text-muted-foreground text-xs font-medium">Name</span>
                <span className="text-muted-foreground w-[68px] text-center text-xs font-medium">
                  Annual
                </span>
                <span className="w-8" />
              </>
            }
            headerClassName="grid-cols-[1fr_auto_auto]"
          >
            {expenseCategoryTypes.map((row) => (
              <li
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2"
                key={row.clientId}
              >
                <Input
                  disabled={disabled}
                  onChange={(e) => updateRow(row.clientId, { name: e.target.value })}
                  placeholder="Category name"
                  value={row.name}
                />
                <div className="flex w-[68px] justify-center">
                  <Checkbox
                    checked={row.isAnnualAmount}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      updateRow(row.clientId, { isAnnualAmount: checked === true })
                    }
                  />
                </div>
                <QuickDeleteButton
                  ariaLabel={`Remove ${row.name || "expense category"}`}
                  disabled={disabled}
                  onClick={(event) => onDeleteRow(row, event)}
                  quickDeleteActive={isQuickDeleteActive}
                />
              </li>
            ))}
          </PropertySettingsScrollableList>
        )}

        <PropertySettingsListFooter
          addLabel="Add category"
          disabled={disabled}
          isSaving={isSavingExpenses}
          onAdd={addRow}
          onSave={onSaveExpenses}
          saveLabel="Save expenses"
          showSave={showSaveExpenses}
        />
      </div>
    );
  }
);
PropertyExpenseCategoryTypesEditor.displayName = "PropertyExpenseCategoryTypesEditor";
