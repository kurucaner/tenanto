import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  PropertyExpenseCategoryTypesEditor,
} from "@/components/settings/property-expense-category-types-editor";
import {
  PropertyIncomeLineTypesEditor,
} from "@/components/settings/property-income-line-types-editor";
import { PercentField } from "@/components/settings/property-settings-percent-field";
import {
  PropertyTaxRatesEditor,
} from "@/components/settings/property-tax-rates-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { settingsApi } from "@/lib/api-client";
import {
  buildSectionPatchBody,
  formStateToBody,
  hasNewRows,
  mergeSavedSectionIntoForm,
  sectionSaveSuccessMessage,
  settingsToFormState,
  type TPropertySettingsFormState,
  type TPropertySettingsListSection,
  validatePropertySettingsForm,
  validatePropertySettingsSection,
} from "@/lib/property-settings-form-utils";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  DEFAULT_PROPERTY_SETTINGS,
  DEFAULT_PROPERTY_TAX_RATES,
  type IPropertySettings,
} from "@/packages/shared";

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
  const [form, setForm] = useState<TPropertySettingsFormState>(savedForm);

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  const hasNewExpenseRows = useMemo(
    () => hasNewRows(form.expenseCategoryTypes),
    [form.expenseCategoryTypes]
  );
  const hasNewIncomeTypeRows = useMemo(
    () => hasNewRows(form.incomeLineTypes),
    [form.incomeLineTypes]
  );
  const hasNewTaxRows = useMemo(() => hasNewRows(form.taxRates), [form.taxRates]);

  const parsePercent = (value: string): number | null => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
    return parsed;
  };

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

  const sectionSaveMutation = useMutation({
    mutationFn: (section: TPropertySettingsListSection) => {
      const validation = validatePropertySettingsSection(section, form);
      if (!validation.ok) {
        throw new Error(validation.error);
      }
      return settingsApi.update(propertyId, buildSectionPatchBody(section, form));
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Save failed");
    },
    onSuccess: (res, section) => {
      toast.success(sectionSaveSuccessMessage[section]);
      queryClient.setQueryData(adminQueryKeys.propertySettings(propertyId), res);
      setForm((prev) => mergeSavedSectionIntoForm(prev, res.settings, section));
    },
  });

  const updateField = (
    field: Exclude<keyof TPropertySettingsFormState, "incomeLineTypes" | "taxRates">,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = useCallback((): boolean => {
    const result = validatePropertySettingsForm(form);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    return true;
  }, [form]);

  const handleSave = useCallback(() => {
    if (!validateForm()) return;
    saveMutation.mutate();
  }, [saveMutation, validateForm]);

  const handleSectionSave = useCallback(
    (section: TPropertySettingsListSection) => {
      sectionSaveMutation.mutate(section);
    },
    [sectionSaveMutation]
  );

  const isPending =
    saveMutation.isPending || resetMutation.isPending || sectionSaveMutation.isPending;

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
            <h3 className="text-sm font-medium">Expense categories</h3>
            <p className="text-muted-foreground text-xs">
              Categories available when adding expenses. Annual categories are spread across months
              in reports. Commission categories are tracked for commission analysis.
            </p>
          </div>
          <PropertyExpenseCategoryTypesEditor
            disabled={!canEdit || isPending}
            expenseCategoryTypes={form.expenseCategoryTypes}
            isSavingExpenses={sectionSaveMutation.isPending}
            onChange={(expenseCategoryTypes) =>
              setForm((prev) => ({ ...prev, expenseCategoryTypes }))
            }
            onSaveExpenses={() => handleSectionSave("expenseCategoryTypes")}
            showSaveExpenses={hasNewExpenseRows}
          />
        </div>

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
            isSavingIncomeType={sectionSaveMutation.isPending}
            onChange={(incomeLineTypes) => setForm((prev) => ({ ...prev, incomeLineTypes }))}
            onSaveIncomeType={() => handleSectionSave("incomeLineTypes")}
            showSaveIncomeType={hasNewIncomeTypeRows}
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
            isSavingTaxRates={sectionSaveMutation.isPending}
            onChange={(taxRates) => setForm((prev) => ({ ...prev, taxRates }))}
            onSaveTaxRates={() => handleSectionSave("taxRates")}
            showSaveTaxRates={hasNewTaxRows}
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
              <p className="text-muted-foreground text-xs">
                Commission base excludes cleaning fee.
              </p>
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
