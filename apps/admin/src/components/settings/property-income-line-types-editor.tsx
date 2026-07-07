import { Plus, Trash2 } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PropertyIncomeLineTypeFormRow {
  clientId: string;
  id?: string;
  name: string;
}

export interface PropertyIncomeLineTypesEditorProps {
  disabled?: boolean;
  incomeLineTypes: PropertyIncomeLineTypeFormRow[];
  onChange: (incomeLineTypes: PropertyIncomeLineTypeFormRow[]) => void;
}

function createClientId(): string {
  return crypto.randomUUID();
}

export const PropertyIncomeLineTypesEditor = memo(
  ({ disabled = false, incomeLineTypes, onChange }: PropertyIncomeLineTypesEditorProps) => {
    const updateRow = (clientId: string, patch: Partial<PropertyIncomeLineTypeFormRow>) => {
      onChange(
        incomeLineTypes.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
      );
    };

    const removeRow = (clientId: string) => {
      onChange(incomeLineTypes.filter((row) => row.clientId !== clientId));
    };

    const addRow = () => {
      onChange([
        ...incomeLineTypes,
        {
          clientId: createClientId(),
          name: "",
        },
      ]);
    };

    return (
      <div className="space-y-3">
        {incomeLineTypes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No other income types configured.</p>
        ) : (
          <ul className="space-y-3">
            {incomeLineTypes.map((row, index) => (
              <li
                className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                key={row.clientId}
              >
                <div className="space-y-2">
                  <Label htmlFor={`income-type-name-${row.clientId}`}>Type name</Label>
                  <Input
                    disabled={disabled}
                    id={`income-type-name-${row.clientId}`}
                    onChange={(event) => updateRow(row.clientId, { name: event.target.value })}
                    placeholder={`Type ${index + 1}`}
                    value={row.name}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    aria-label={`Remove ${row.name || "income type"}`}
                    disabled={disabled}
                    onClick={() => removeRow(row.clientId)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button
          className="gap-1.5"
          disabled={disabled}
          onClick={addRow}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="size-3.5" />
          Add income type
        </Button>
      </div>
    );
  }
);
PropertyIncomeLineTypesEditor.displayName = "PropertyIncomeLineTypesEditor";
