import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { PropertyChannelCommissionsEditor } from "@/components/settings/property-channel-commissions-editor";
import { PropertyExpenseCategoryTypesEditor } from "@/components/settings/property-expense-category-types-editor";
import { PropertyIncomeLineTypesEditor } from "@/components/settings/property-income-line-types-editor";
import { PropertyTaxRatesEditor } from "@/components/settings/property-tax-rates-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usePropertySettingsListRowDelete } from "@/hooks/use-property-settings-list-row-delete";
import { settingsApi } from "@/lib/api-client";
import {
  buildSectionPatchBody,
  channelCommissionsDiffer,
  expenseCategoryTypesDiffer,
  formStateToBody,
  hasNewRows,
  mergeSavedSectionIntoForm,
  sectionSaveSuccessMessage,
  settingsToFormState,
  taxRatesDiffer,
  type TPropertySettingsFormState,
  type TPropertySettingsListSection,
  validatePropertySettingsForm,
  validatePropertySettingsSection,
} from "@/lib/property-settings-form-utils";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  DEFAULT_PROPERTY_CHANNEL_COMMISSIONS,
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

  const hasExpenseSectionChanges = useMemo(
    () => expenseCategoryTypesDiffer(form.expenseCategoryTypes, savedForm.expenseCategoryTypes),
    [form.expenseCategoryTypes, savedForm.expenseCategoryTypes]
  );
  const hasNewIncomeTypeRows = useMemo(
    () => hasNewRows(form.incomeLineTypes),
    [form.incomeLineTypes]
  );
  const hasChannelSectionChanges = useMemo(
    () => channelCommissionsDiffer(form.channelCommissions, savedForm.channelCommissions),
    [form.channelCommissions, savedForm.channelCommissions]
  );
  const hasTaxSectionChanges = useMemo(
    () => taxRatesDiffer(form.taxRates, savedForm.taxRates),
    [form.taxRates, savedForm.taxRates]
  );

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
        channelCommissions: DEFAULT_PROPERTY_CHANNEL_COMMISSIONS.map((channel, index) => ({
          excludeCleaningFromCommissionBase: channel.excludeCleaningFromCommissionBase ?? false,
          excludeResortTaxFromPayout: channel.excludeResortTaxFromPayout ?? false,
          name: channel.name,
          rate: channel.rate,
          sortOrder: index,
        })),
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

  const removeExpenseCategory = useCallback((clientId: string) => {
    setForm((prev) => ({
      ...prev,
      expenseCategoryTypes: prev.expenseCategoryTypes.filter((row) => row.clientId !== clientId),
    }));
  }, []);

  const removeIncomeLineType = useCallback((clientId: string) => {
    setForm((prev) => ({
      ...prev,
      incomeLineTypes: prev.incomeLineTypes.filter((row) => row.clientId !== clientId),
    }));
  }, []);

  const removeTaxRate = useCallback((clientId: string) => {
    setForm((prev) => ({
      ...prev,
      taxRates: prev.taxRates.filter((row) => row.clientId !== clientId),
    }));
  }, []);

  const removeChannelCommission = useCallback((clientId: string) => {
    setForm((prev) => ({
      ...prev,
      channelCommissions: prev.channelCommissions.filter((row) => row.clientId !== clientId),
    }));
  }, []);

  const expenseDelete = usePropertySettingsListRowDelete({
    entityLabel: "expense category",
    onRemove: removeExpenseCategory,
  });

  const incomeDelete = usePropertySettingsListRowDelete({
    entityLabel: "income type",
    onRemove: removeIncomeLineType,
  });

  const taxDelete = usePropertySettingsListRowDelete({
    entityLabel: "tax rate",
    onRemove: removeTaxRate,
  });

  const channelDelete = usePropertySettingsListRowDelete({
    entityLabel: "channel",
    onRemove: removeChannelCommission,
  });

  const isQuickDeleteActive =
    expenseDelete.isQuickDeleteActive ||
    incomeDelete.isQuickDeleteActive ||
    taxDelete.isQuickDeleteActive ||
    channelDelete.isQuickDeleteActive;

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
    <>
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
        <CardContent className="space-y-8 pt-2">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Expense categories</h3>
              <p className="text-muted-foreground text-xs">
                Categories available when adding expenses. Annual categories are spread across
                months in reports. Commission categories are tracked for commission analysis.
              </p>
            </div>
            <PropertyExpenseCategoryTypesEditor
              disabled={!canEdit || isPending}
              expenseCategoryTypes={form.expenseCategoryTypes}
              isQuickDeleteActive={isQuickDeleteActive}
              isSavingExpenses={sectionSaveMutation.isPending}
              onChange={(expenseCategoryTypes) =>
                setForm((prev) => ({ ...prev, expenseCategoryTypes }))
              }
              onDeleteRow={expenseDelete.handleDelete}
              onSaveExpenses={() => handleSectionSave("expenseCategoryTypes")}
              showSaveExpenses={hasExpenseSectionChanges}
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
              isQuickDeleteActive={isQuickDeleteActive}
              isSavingIncomeType={sectionSaveMutation.isPending}
              onChange={(incomeLineTypes) => setForm((prev) => ({ ...prev, incomeLineTypes }))}
              onDeleteRow={incomeDelete.handleDelete}
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
              isQuickDeleteActive={isQuickDeleteActive}
              isSavingTaxRates={sectionSaveMutation.isPending}
              onChange={(taxRates) => setForm((prev) => ({ ...prev, taxRates }))}
              onDeleteRow={taxDelete.handleDelete}
              onSaveTaxRates={() => handleSectionSave("taxRates")}
              showSaveTaxRates={hasTaxSectionChanges}
              taxRates={form.taxRates}
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Channel commissions</h3>
              <p className="text-muted-foreground text-xs">
                Booking channels available when adding stays. Use the rules to match each
                channel&apos;s commission base and payout treatment.
              </p>
            </div>
            <PropertyChannelCommissionsEditor
              channelCommissions={form.channelCommissions}
              disabled={!canEdit || isPending}
              isQuickDeleteActive={isQuickDeleteActive}
              isSavingChannelCommissions={sectionSaveMutation.isPending}
              onChange={(channelCommissions) =>
                setForm((prev) => ({ ...prev, channelCommissions }))
              }
              onDeleteRow={channelDelete.handleDelete}
              onSaveChannelCommissions={() => handleSectionSave("channelCommissions")}
              showSaveChannelCommissions={hasChannelSectionChanges}
            />
          </div>

          {canEdit ? null : (
            <p className="text-muted-foreground text-sm">
              Only property owners can edit these settings.
            </p>
          )}
        </CardContent>
      </Card>
      {expenseDelete.deleteConfirmationDialog}
      {incomeDelete.deleteConfirmationDialog}
      {taxDelete.deleteConfirmationDialog}
      {channelDelete.deleteConfirmationDialog}
    </>
  );

  return { formContent, headerActions };
};
