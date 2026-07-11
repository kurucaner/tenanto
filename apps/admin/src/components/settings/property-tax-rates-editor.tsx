import { Trash2 } from "lucide-react";
import { memo } from "react";

import { PropertySettingsListFooter } from "@/components/settings/property-settings-list-footer";
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
  isSavingTaxRates?: boolean;
  onChange: (taxRates: PropertyTaxRateFormRow[]) => void;
  onSaveTaxRates?: () => void;
  showSaveTaxRates?: boolean;
  taxRates: PropertyTaxRateFormRow[];
}

function createClientId(): string {
  return crypto.randomUUID();
}

export const PropertyTaxRatesEditor = memo(
  ({
    disabled = false,
    isSavingTaxRates = false,
    onChange,
    onSaveTaxRates,
    showSaveTaxRates = false,
    taxRates,
  }: PropertyTaxRatesEditorProps) => {
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
              {taxRates.map((row) => (
                <li
                  className="grid grid-cols-[1fr_140px_auto] items-center gap-3 px-3 py-2"
                  key={row.clientId}
                >
                  <Input
                    disabled={disabled}
                    onChange={(e) => updateRow(row.clientId, { name: e.target.value })}
                    placeholder="Tax name"
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

        <PropertySettingsListFooter
          addLabel="Add tax"
          disabled={disabled}
          isSaving={isSavingTaxRates}
          onAdd={addRow}
          onSave={onSaveTaxRates}
          saveLabel="Save tax rates"
          showSave={showSaveTaxRates}
        />
      </div>
    );
  }
);
PropertyTaxRatesEditor.displayName = "PropertyTaxRatesEditor";
