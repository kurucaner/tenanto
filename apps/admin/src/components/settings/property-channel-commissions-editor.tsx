import { memo, type MouseEvent } from "react";

import { PropertySettingsListFooter } from "@/components/settings/property-settings-list-footer";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";

export interface PropertyChannelCommissionFormRow {
  clientId: string;
  excludeCleaningFromCommissionBase: boolean;
  excludeResortTaxFromPayout: boolean;
  id?: string;
  name: string;
  ratePercent: string;
}

export interface PropertyChannelCommissionsEditorProps {
  channelCommissions: PropertyChannelCommissionFormRow[];
  disabled?: boolean;
  isQuickDeleteActive: boolean;
  isSavingChannelCommissions?: boolean;
  onChange: (channelCommissions: PropertyChannelCommissionFormRow[]) => void;
  onDeleteRow: (
    row: PropertyChannelCommissionFormRow,
    event?: MouseEvent<HTMLButtonElement>
  ) => void;
  onSaveChannelCommissions?: () => void;
  showSaveChannelCommissions?: boolean;
}

function createClientId(): string {
  return crypto.randomUUID();
}

export const PropertyChannelCommissionsEditor = memo(
  ({
    channelCommissions,
    disabled = false,
    isQuickDeleteActive,
    isSavingChannelCommissions = false,
    onChange,
    onDeleteRow,
    onSaveChannelCommissions,
    showSaveChannelCommissions = false,
  }: PropertyChannelCommissionsEditorProps) => {
    const updateRow = (clientId: string, patch: Partial<PropertyChannelCommissionFormRow>) => {
      onChange(
        channelCommissions.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
      );
    };

    const addRow = () => {
      onChange([
        ...channelCommissions,
        {
          clientId: createClientId(),
          excludeCleaningFromCommissionBase: false,
          excludeResortTaxFromPayout: false,
          name: "",
          ratePercent: "0",
        },
      ]);
    };

    return (
      <div className="space-y-3">
        {channelCommissions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No channels configured.</p>
        ) : (
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_140px_auto_auto] items-center gap-3 border-b px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">Name</span>
              <span className="text-muted-foreground text-xs font-medium">Rate</span>
              <span className="text-muted-foreground text-xs font-medium">Rules</span>
              <span className="w-8" />
            </div>
            <ul className="divide-y">
              {channelCommissions.map((row) => (
                <li
                  className="grid grid-cols-[1fr_140px_auto_auto] items-start gap-3 px-3 py-2"
                  key={row.clientId}
                >
                  <Input
                    className="mt-0.5"
                    disabled={disabled}
                    onChange={(e) => updateRow(row.clientId, { name: e.target.value })}
                    placeholder="Channel name"
                    value={row.name}
                  />
                  <div className="relative mt-0.5">
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
                  <div className="space-y-2 py-0.5">
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={row.excludeCleaningFromCommissionBase}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          updateRow(row.clientId, {
                            excludeCleaningFromCommissionBase: checked === true,
                          })
                        }
                      />
                      Exclude cleaning from commission base
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={row.excludeResortTaxFromPayout}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          updateRow(row.clientId, {
                            excludeResortTaxFromPayout: checked === true,
                          })
                        }
                      />
                      Exclude resort tax from payout
                    </label>
                  </div>
                  <div className="mt-0.5">
                    <QuickDeleteButton
                      ariaLabel={`Remove ${row.name || "channel"}`}
                      disabled={disabled}
                      onClick={(event) => onDeleteRow(row, event)}
                      quickDeleteActive={isQuickDeleteActive}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <PropertySettingsListFooter
          addLabel="Add channel"
          disabled={disabled}
          isSaving={isSavingChannelCommissions}
          onAdd={addRow}
          onSave={onSaveChannelCommissions}
          saveLabel="Save channel commissions"
          showSave={showSaveChannelCommissions}
        />
      </div>
    );
  }
);
PropertyChannelCommissionsEditor.displayName = "PropertyChannelCommissionsEditor";
