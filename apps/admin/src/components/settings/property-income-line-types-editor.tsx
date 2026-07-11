import { Trash2 } from "lucide-react";
import { memo } from "react";

import { PropertySettingsListFooter } from "@/components/settings/property-settings-list-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PropertyIncomeLineTypeFormRow {
  clientId: string;
  id?: string;
  name: string;
}

export interface PropertyIncomeLineTypesEditorProps {
  disabled?: boolean;
  incomeLineTypes: PropertyIncomeLineTypeFormRow[];
  isSavingIncomeType?: boolean;
  onChange: (incomeLineTypes: PropertyIncomeLineTypeFormRow[]) => void;
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
    isSavingIncomeType = false,
    onChange,
    onSaveIncomeType,
    showSaveIncomeType = false,
  }: PropertyIncomeLineTypesEditorProps) => {
    const updateRow = (clientId: string, patch: Partial<PropertyIncomeLineTypeFormRow>) => {
      onChange(
        incomeLineTypes.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
      );
    };

    const removeRow = (clientId: string) => {
      onChange(incomeLineTypes.filter((row) => row.clientId !== clientId));
    };

    const addRow = () => {
      onChange([...incomeLineTypes, { clientId: createClientId(), name: "" }]);
    };

    return (
      <div className="space-y-3">
        {incomeLineTypes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No other income types configured.</p>
        ) : (
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">Name</span>
              <span className="w-8" />
            </div>
            <ul className="divide-y">
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
                  <Button
                    aria-label={`Remove ${row.name || "income type"}`}
                    disabled={disabled}
                    onClick={() => removeRow(row.clientId)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
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
