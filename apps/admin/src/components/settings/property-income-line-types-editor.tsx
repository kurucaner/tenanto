import { Plus, Trash2 } from "lucide-react";
import { memo } from "react";

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
              {incomeLineTypes.map((row, index) => (
                <li
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2"
                  key={row.clientId}
                >
                  <Input
                    disabled={disabled}
                    onChange={(e) => updateRow(row.clientId, { name: e.target.value })}
                    placeholder={`Type ${index + 1}`}
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
