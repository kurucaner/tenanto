import { Plus, Trash2 } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
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
        { clientId: createClientId(), isAnnualAmount: false, name: "" },
      ]);
    };

    return (
      <div className="space-y-3">
        {expenseCategoryTypes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No expense categories configured.</p>
        ) : (
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">Name</span>
              <span className="text-muted-foreground w-[68px] text-center text-xs font-medium">
                Annual
              </span>
              <span className="w-8" />
            </div>
            <ul className="divide-y">
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
                  <Button
                    aria-label={`Remove ${row.name || "expense category"}`}
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
          Add category
        </Button>
      </div>
    );
  }
);
PropertyExpenseCategoryTypesEditor.displayName = "PropertyExpenseCategoryTypesEditor";
