import { Plus, Trash2 } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";

export interface PropertyTaxRateFormRow {
  clientId: string;
  id?: string;
  name: string;
  ratePercent: string;
}

export interface PropertyTaxRatesEditorProps {
  disabled?: boolean;
  onChange: (taxRates: PropertyTaxRateFormRow[]) => void;
  taxRates: PropertyTaxRateFormRow[];
}

function createClientId(): string {
  return crypto.randomUUID();
}

export const PropertyTaxRatesEditor = memo(
  ({ disabled = false, onChange, taxRates }: PropertyTaxRatesEditorProps) => {
    const updateRow = (clientId: string, patch: Partial<PropertyTaxRateFormRow>) => {
      onChange(taxRates.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)));
    };

    const removeRow = (clientId: string) => {
      onChange(taxRates.filter((row) => row.clientId !== clientId));
    };

    const addRow = () => {
      onChange([...taxRates, { clientId: createClientId(), name: "", ratePercent: "0" }]);
    };

    return (
      <div className="space-y-3">
        {taxRates.length === 0 ? (
          <p className="text-muted-foreground text-sm">No taxes configured.</p>
        ) : (
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_140px_auto] items-center gap-3 border-b px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">Name</span>
              <span className="text-muted-foreground text-xs font-medium">Rate</span>
              <span className="w-8" />
            </div>
            <ul className="divide-y">
              {taxRates.map((row, index) => (
                <li
                  className="grid grid-cols-[1fr_140px_auto] items-center gap-3 px-3 py-2"
                  key={row.clientId}
                >
                  <Input
                    disabled={disabled}
                    onChange={(e) => updateRow(row.clientId, { name: e.target.value })}
                    placeholder={`Tax ${index + 1}`}
                    value={row.name}
                  />
                  <div className="relative">
                    <Input
                      disabled={disabled}
                      inputMode="decimal"
                      onChange={(e) => {
                        if (isValidDecimalInput(e.target.value))
                          updateRow(row.clientId, { ratePercent: e.target.value });
                      }}
                      type="text"
                      value={row.ratePercent}
                    />
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                      %
                    </span>
                  </div>
                  <Button
                    aria-label={`Remove ${row.name || "tax"}`}
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
          Add tax
        </Button>
      </div>
    );
  }
);
PropertyTaxRatesEditor.displayName = "PropertyTaxRatesEditor";
