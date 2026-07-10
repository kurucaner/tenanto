import { Plus, Trash2 } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PropertyExpenseCategoryTypeFormRow {
  clientId: string;
  id?: string;
  isAnnualAmount: boolean;
  name: string;
}

export interface PropertyExpenseCategoryTypesEditorProps {
  disabled?: boolean;
  expenseCategoryTypes: PropertyExpenseCategoryTypeFormRow[];
  onChange: (expenseCategoryTypes: PropertyExpenseCategoryTypeFormRow[]) => void;
}

function createClientId(): string {
  return crypto.randomUUID();
}

export const PropertyExpenseCategoryTypesEditor = memo(
  ({
    disabled = false,
    expenseCategoryTypes,
    onChange,
  }: PropertyExpenseCategoryTypesEditorProps) => {
    const updateRow = (clientId: string, patch: Partial<PropertyExpenseCategoryTypeFormRow>) => {
      onChange(
        expenseCategoryTypes.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
      );
    };

    const removeRow = (clientId: string) => {
      onChange(expenseCategoryTypes.filter((row) => row.clientId !== clientId));
    };

    const addRow = () => {
      onChange([
        ...expenseCategoryTypes,
        {
          clientId: createClientId(),
          isAnnualAmount: false,
          name: "",
        },
      ]);
    };

    return (
      <div className="space-y-3">
        {expenseCategoryTypes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No expense categories configured.</p>
        ) : (
          <ul className="space-y-3">
            {expenseCategoryTypes.map((row) => (
              <li
                className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                key={row.clientId}
              >
                <div className="space-y-2">
                  <Label htmlFor={`expense-cat-name-${row.clientId}`}>Category name</Label>
                  <Input
                    disabled={disabled}
                    id={`expense-cat-name-${row.clientId}`}
                    onChange={(event) => updateRow(row.clientId, { name: event.target.value })}
                    placeholder="Expense category name"
                    value={row.name}
                  />
                </div>
                <div className="flex flex-col gap-2 justify-end pb-0.5">
                  <Label className="flex items-center gap-1.5 text-xs font-normal cursor-pointer">
                    <input
                      checked={row.isAnnualAmount}
                      className="rounded"
                      disabled={disabled}
                      onChange={(e) =>
                        updateRow(row.clientId, { isAnnualAmount: e.target.checked })
                      }
                      type="checkbox"
                    />
                    {"Annual"}
                  </Label>
                </div>
                <div className="flex items-end pb-0.5">
                  <Button
                    aria-label={`Remove ${row.name || "expense category"}`}
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
          Add category
        </Button>
      </div>
    );
  }
);
PropertyExpenseCategoryTypesEditor.displayName = "PropertyExpenseCategoryTypesEditor";
