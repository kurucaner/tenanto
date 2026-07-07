import { Plus, Trash2 } from "lucide-react";
import { memo } from "react";

import { PercentField } from "@/components/settings/property-settings-percent-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      onChange(
        taxRates.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
      );
    };

    const removeRow = (clientId: string) => {
      onChange(taxRates.filter((row) => row.clientId !== clientId));
    };

    const addRow = () => {
      onChange([
        ...taxRates,
        {
          clientId: createClientId(),
          name: "",
          ratePercent: "0",
        },
      ]);
    };

    return (
      <div className="space-y-3">
        {taxRates.length === 0 ? (
          <p className="text-muted-foreground text-sm">No taxes configured.</p>
        ) : (
          <ul className="space-y-3">
            {taxRates.map((row, index) => (
              <li
                className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
                key={row.clientId}
              >
                <div className="space-y-2">
                  <Label htmlFor={`tax-name-${row.clientId}`}>Tax name</Label>
                  <Input
                    disabled={disabled}
                    id={`tax-name-${row.clientId}`}
                    onChange={(event) => updateRow(row.clientId, { name: event.target.value })}
                    placeholder={`Tax ${index + 1}`}
                    value={row.name}
                  />
                </div>
                <PercentField
                  disabled={disabled}
                  id={`tax-rate-${row.clientId}`}
                  label="Rate"
                  onChange={(value) => updateRow(row.clientId, { ratePercent: value })}
                  value={row.ratePercent}
                />
                <div className="flex items-end">
                  <Button
                    aria-label={`Remove ${row.name || "tax"}`}
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
          Add tax
        </Button>
      </div>
    );
  }
);
PropertyTaxRatesEditor.displayName = "PropertyTaxRatesEditor";
