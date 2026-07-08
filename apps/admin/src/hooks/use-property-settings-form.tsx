import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type PropertyIncomeLineTypeFormRow,
  PropertyIncomeLineTypesEditor,
} from "@/components/settings/property-income-line-types-editor";
import { PercentField } from "@/components/settings/property-settings-percent-field";
import {
  type PropertyTaxRateFormRow,
  PropertyTaxRatesEditor,
} from "@/components/settings/property-tax-rates-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { settingsApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  DEFAULT_PROPERTY_SETTINGS,
  DEFAULT_PROPERTY_TAX_RATES,
  formatRateAsPercent,
  type IPropertyIncomeLineType,
  type IPropertyIncomeLineTypeInput,
  type IPropertySettings,
  type IPropertyTaxRate,
  type IPropertyTaxRateInput,
  percentToRate,
} from "@/packages/shared";

type TSettingsFormState = {
  airbnbCommissionRate: string;
  bookingCommissionRate: string;
  directCommissionRate: string;
  expediaCommissionRate: string;
  incomeLineTypes: PropertyIncomeLineTypeFormRow[];
  taxRates: PropertyTaxRateFormRow[];
};

const MAX_TAX_NAME_LENGTH = 80;
const MAX_INCOME_TYPE_NAME_LENGTH = 80;

const taxRateToFormRow = (tax: IPropertyTaxRate): PropertyTaxRateFormRow => ({
  clientId: tax.id,
  id: tax.id,
  name: tax.name,
  ratePercent: formatRateAsPercent(tax.rate),
});

const incomeLineTypeToFormRow = (type: IPropertyIncomeLineType): PropertyIncomeLineTypeFormRow => ({
  clientId: type.id,
  id: type.id,
  name: type.name,
});

const settingsToFormState = (settings: IPropertySettings): TSettingsFormState => ({
  airbnbCommissionRate: formatRateAsPercent(settings.airbnbCommissionRate),
  bookingCommissionRate: formatRateAsPercent(settings.bookingCommissionRate),
  directCommissionRate: formatRateAsPercent(settings.directCommissionRate),
  expediaCommissionRate: formatRateAsPercent(settings.expediaCommissionRate),
  incomeLineTypes: settings.incomeLineTypes.map(incomeLineTypeToFormRow),
  taxRates: settings.taxRates.map(taxRateToFormRow),
});

const formTaxRatesToBody = (taxRates: PropertyTaxRateFormRow[]): IPropertyTaxRateInput[] =>
  taxRates.map((row, index) => ({
    ...(row.id == null ? {} : { id: row.id }),
    name: row.name.trim(),
    rate: percentToRate(Number(row.ratePercent)),
    sortOrder: index,
  }));

const formIncomeLineTypesToBody = (
  incomeLineTypes: PropertyIncomeLineTypeFormRow[]
): IPropertyIncomeLineTypeInput[] =>
  incomeLineTypes.map((row, index) => ({
    ...(row.id == null ? {} : { id: row.id }),
    name: row.name.trim(),
    sortOrder: index,
  }));

const formStateToBody = (form: TSettingsFormState) => ({
  airbnbCommissionRate: percentToRate(Number(form.airbnbCommissionRate)),
  bookingCommissionRate: percentToRate(Number(form.bookingCommissionRate)),
  directCommissionRate: percentToRate(Number(form.directCommissionRate)),
  expediaCommissionRate: percentToRate(Number(form.expediaCommissionRate)),
  incomeLineTypes: formIncomeLineTypesToBody(form.incomeLineTypes),
  taxRates: formTaxRatesToBody(form.taxRates),
});

const parsePercent = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
};

interface UsePropertySettingsFormOptions {
  canEdit: boolean;
  propertyId: string;
  settings: IPropertySettings;
}

export const usePropertySettingsForm = ({
  canEdit,
  propertyId,
  settings,
}: UsePropertySettingsFormOptions) => {
  const queryClient = useQueryClient();
  const savedForm = useMemo(() => settingsToFormState(settings), [settings]);
  const [form, setForm] = useState<TSettingsFormState>(savedForm);

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  const totalTaxPercent = useMemo(() => {
    let total = 0;
    for (const row of form.taxRates) {
      const value = parsePercent(row.ratePercent);
      if (value === null) return null;
      total += value;
    }
    return total;
  }, [form.taxRates]);

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.update(propertyId, formStateToBody(form)),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Save failed");
    },
    onSuccess: (res) => {
      toast.success("Settings saved");
      queryClient.setQueryData(adminQueryKeys.propertySettings(propertyId), res);
      setForm(settingsToFormState(res.settings));
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      settingsApi.update(propertyId, {
        ...DEFAULT_PROPERTY_SETTINGS,
        taxRates: DEFAULT_PROPERTY_TAX_RATES.map((tax, index) => ({
          name: tax.name,
          rate: tax.rate,
          sortOrder: index,
        })),
      }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    },
    onSuccess: (res) => {
      toast.success("Settings reset to defaults");
      queryClient.setQueryData(adminQueryKeys.propertySettings(propertyId), res);
      setForm(settingsToFormState(res.settings));
    },
  });

  const updateField = (
    field: Exclude<keyof TSettingsFormState, "incomeLineTypes" | "taxRates">,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = useCallback((): boolean => {
    const commissionFields = [
      form.airbnbCommissionRate,
      form.bookingCommissionRate,
      form.directCommissionRate,
      form.expediaCommissionRate,
    ];
    if (commissionFields.some((value) => parsePercent(value) === null)) {
      toast.error("All commission rates must be numbers between 0 and 100");
      return false;
    }

    const seenTaxNames = new Set<string>();
    for (const row of form.taxRates) {
      const name = row.name.trim();
      if (name.length === 0) {
        toast.error("Each tax must have a name");
        return false;
      }
      if (name.length > MAX_TAX_NAME_LENGTH) {
        toast.error(`Tax names must be at most ${MAX_TAX_NAME_LENGTH} characters`);
        return false;
      }
      const normalized = name.toLowerCase();
      if (seenTaxNames.has(normalized)) {
        toast.error("Tax names must be unique");
        return false;
      }
      seenTaxNames.add(normalized);

      if (parsePercent(row.ratePercent) === null) {
        toast.error("All tax rates must be numbers between 0 and 100");
        return false;
      }
    }

    const seenIncomeTypeNames = new Set<string>();
    for (const row of form.incomeLineTypes) {
      const name = row.name.trim();
      if (name.length === 0) {
        toast.error("Each other income type must have a name");
        return false;
      }
      if (name.length > MAX_INCOME_TYPE_NAME_LENGTH) {
        toast.error(`Income type names must be at most ${MAX_INCOME_TYPE_NAME_LENGTH} characters`);
        return false;
      }
      const normalized = name.toLowerCase();
      if (seenIncomeTypeNames.has(normalized)) {
        toast.error("Income type names must be unique");
        return false;
      }
      seenIncomeTypeNames.add(normalized);
    }

    return true;
  }, [form]);

  const handleSave = useCallback(() => {
    if (!validateForm()) return;
    saveMutation.mutate();
  }, [saveMutation, validateForm]);

  const isPending = saveMutation.isPending || resetMutation.isPending;

  const headerActions: ReactNode = useMemo(
    () =>
      canEdit ? (
        <>
          <Button
            className="gap-1.5"
            disabled={!hasChanges || isPending}
            onClick={handleSave}
            size="sm"
            type="button"
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            className="gap-1.5"
            disabled={isPending}
            onClick={() => resetMutation.mutate()}
            size="sm"
            type="button"
            variant="outline"
          >
            {resetMutation.isPending ? "Resetting…" : "Reset to defaults"}
          </Button>
        </>
      ) : undefined,
    [canEdit, handleSave, hasChanges, isPending, resetMutation, saveMutation.isPending]
  );

  const formContent = (
    <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="text-muted-foreground size-4" />
          <CardTitle className="text-lg">Property settings</CardTitle>
        </div>
        <CardDescription>
          Tax, other income types, and channel commission rates used for income calculations.
        </CardDescription>
        <p className="text-muted-foreground text-xs">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
        </p>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-8 pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium">Other income types</h3>
            <p className="text-muted-foreground text-xs">
              Types available when adding other income and filtering the income table.
            </p>
          </div>
          <PropertyIncomeLineTypesEditor
            disabled={!canEdit || isPending}
            incomeLineTypes={form.incomeLineTypes}
            onChange={(incomeLineTypes) => setForm((prev) => ({ ...prev, incomeLineTypes }))}
          />
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium">Tax rates</h3>
            <p className="text-muted-foreground text-xs">
              Applied to net room rate + cleaning fee for short-term stays.
              {totalTaxPercent === null ? (
                <> Enter valid percentages to see total.</>
              ) : (
                <> Total tax: {totalTaxPercent.toFixed(1)}%</>
              )}
            </p>
          </div>
          <PropertyTaxRatesEditor
            disabled={!canEdit || isPending}
            onChange={(taxRates) => setForm((prev) => ({ ...prev, taxRates }))}
            taxRates={form.taxRates}
          />
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium">Channel commissions</h3>
            <p className="text-muted-foreground text-xs">
              Applied to room total + cleaning fee for most channels. Expedia uses room total only.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PercentField
              disabled={!canEdit || isPending}
              id="airbnb-commission"
              label="Airbnb"
              onChange={(v) => updateField("airbnbCommissionRate", v)}
              value={form.airbnbCommissionRate}
            />
            <PercentField
              disabled={!canEdit || isPending}
              id="booking-commission"
              label="Booking.com"
              onChange={(v) => updateField("bookingCommissionRate", v)}
              value={form.bookingCommissionRate}
            />
            <div className="flex flex-col gap-1.5">
              <PercentField
                disabled={!canEdit || isPending}
                id="expedia-commission"
                label="Expedia"
                onChange={(v) => updateField("expediaCommissionRate", v)}
                value={form.expediaCommissionRate}
              />
              <p className="text-muted-foreground text-xs">Commission base excludes cleaning fee.</p>
            </div>
            <PercentField
              disabled={!canEdit || isPending}
              id="direct-commission"
              label="Direct web / merchant"
              onChange={(v) => updateField("directCommissionRate", v)}
              value={form.directCommissionRate}
            />
          </div>
        </div>

        {canEdit ? null : (
          <p className="text-muted-foreground text-sm">
            Only property owners can edit these settings.
          </p>
        )}
      </CardContent>
    </Card>
  );

  return { formContent, headerActions };
};
