import { memo, type MouseEvent } from "react";

import { PropertySettingsListFooter } from "@/components/settings/property-settings-list-footer";
import { PropertySettingsScrollableList } from "@/components/settings/property-settings-scrollable-list";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Input } from "@/components/ui/input";

export interface PropertyIncomeLineTypeFormRow {
  clientId: string;
  id?: string;
  name: string;
}

export interface PropertyIncomeLineTypesEditorProps {
  disabled?: boolean;
  incomeLineTypes: PropertyIncomeLineTypeFormRow[];
  isQuickDeleteActive: boolean;
  isSavingIncomeType?: boolean;
  onChange: (incomeLineTypes: PropertyIncomeLineTypeFormRow[]) => void;
  onDeleteRow: (row: PropertyIncomeLineTypeFormRow, event?: MouseEvent<HTMLButtonElement>) => void;
  onSaveIncomeType?: () => void;
  showSaveIncomeType?: boolean;
}

function createClientId(): string {
  return crypto.randomUUID();
}

export const PropertyIncomeLineTypesEditor = memo(
  ({
    disabled = false,
    incomeLineTypes,
    isQuickDeleteActive,
    isSavingIncomeType = false,
    onChange,
    onDeleteRow,
    onSaveIncomeType,
    showSaveIncomeType = false,
  }: PropertyIncomeLineTypesEditorProps) => {
    const updateRow = (clientId: string, patch: Partial<PropertyIncomeLineTypeFormRow>) => {
      onChange(
        incomeLineTypes.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
      );
    };

    const addRow = () => {
      onChange([...incomeLineTypes, { clientId: createClientId(), name: "" }]);
    };

    return (
      <div className="space-y-3">
        {incomeLineTypes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No other income types configured.</p>
        ) : (
          <PropertySettingsScrollableList
            header={
              <>
                <span className="text-muted-foreground text-xs font-medium">Name</span>
                <span className="w-8" />
              </>
            }
            headerClassName="grid-cols-[1fr_auto]"
          >
            {incomeLineTypes.map((row) => (
              <li
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2"
                key={row.clientId}
              >
                <Input
                  disabled={disabled}
                  onChange={(e) => updateRow(row.clientId, { name: e.target.value })}
                  placeholder="Income type name"
                  value={row.name}
                />
                <QuickDeleteButton
                  ariaLabel={`Remove ${row.name || "income type"}`}
                  disabled={disabled}
                  onClick={(event) => onDeleteRow(row, event)}
                  quickDeleteActive={isQuickDeleteActive}
                />
              </li>
            ))}
          </PropertySettingsScrollableList>
        )}

        <PropertySettingsListFooter
          addLabel="Add income type"
          disabled={disabled}
          isSaving={isSavingIncomeType}
          onAdd={addRow}
          onSave={onSaveIncomeType}
          saveLabel="Save income type"
          showSave={showSaveIncomeType}
        />
      </div>
    );
  }
);
PropertyIncomeLineTypesEditor.displayName = "PropertyIncomeLineTypesEditor";
