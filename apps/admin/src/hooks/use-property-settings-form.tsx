import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { PropertyChannelCommissionsCatalog } from "@/components/settings/property-channel-commissions-catalog";
import { PropertyExpenseCategoriesCatalog } from "@/components/settings/property-expense-categories-catalog";
import { PropertyIncomeLineTypesCatalog } from "@/components/settings/property-income-line-types-catalog";
import { PropertyTaxRatesCatalog } from "@/components/settings/property-tax-rates-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UrlSyncedTabs, UrlSyncedTabsContent } from "@/components/url-synced-tabs";
import { usePropertySettingsListRowDelete } from "@/hooks/use-property-settings-list-row-delete";
import { useUrlTabState } from "@/hooks/use-url-tab-state";
import { settingsApi } from "@/lib/api-client";
import {
  type PropertyChannelCommissionFormRow,
  type PropertyExpenseCategoryTypeFormRow,
  type PropertyIncomeLineTypeFormRow,
  type PropertyTaxRateFormRow,
} from "@/lib/property-settings-form-types";
import {
  buildSectionPatchBody,
  mergeSavedSectionIntoForm,
  sectionSaveSuccessMessage,
  settingsToFormState,
  type TPropertySettingsFormState,
  type TPropertySettingsListSection,
  validatePropertySettingsSection,
} from "@/lib/property-settings-form-utils";
import {
  PROPERTY_SETTINGS_TAB_DEFINITIONS,
  PROPERTY_SETTINGS_TABS,
} from "@/lib/property-settings-tab-schema";
import { queryKeys } from "@/lib/query-keys";
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

type TSectionSaveVariables = {
  nextForm: TPropertySettingsFormState;
  section: TPropertySettingsListSection;
};

function upsertNamedRow<T extends { clientId: string }>(rows: T[], row: T): T[] {
  const exists = rows.some((candidate) => candidate.clientId === row.clientId);
  if (exists) {
    return rows.map((candidate) => (candidate.clientId === row.clientId ? row : candidate));
  }
  return [...rows, row];
}

export const usePropertySettingsForm = ({
  canEdit,
  propertyId,
  settings,
}: UsePropertySettingsFormOptions) => {
  const queryClient = useQueryClient();
  const savedForm = useMemo(() => settingsToFormState(settings), [settings]);
  const [form, setForm] = useState<TPropertySettingsFormState>(savedForm);
  const { activeTab, setActiveTab } = useUrlTabState(PROPERTY_SETTINGS_TABS, "expenses");

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
      queryClient.setQueryData(queryKeys.propertySettings(propertyId), res);
      setForm(settingsToFormState(res.settings));
    },
  });

  const sectionSaveMutation = useMutation({
    mutationFn: ({ nextForm, section }: TSectionSaveVariables) => {
      const validation = validatePropertySettingsSection(section, nextForm);
      if (!validation.ok) {
        throw new Error(validation.error);
      }
      return settingsApi.update(propertyId, buildSectionPatchBody(section, nextForm));
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setForm(settingsToFormState(settings));
    },
    onSuccess: (res, { section }) => {
      toast.success(sectionSaveSuccessMessage[section]);
      queryClient.setQueryData(queryKeys.propertySettings(propertyId), res);
      setForm((prev) => mergeSavedSectionIntoForm(prev, res.settings, section));
    },
  });

  const isPending = resetMutation.isPending || sectionSaveMutation.isPending;

  const upsertExpenseCategory = useCallback(
    (row: PropertyExpenseCategoryTypeFormRow) => {
      setForm((prev) => {
        const nextForm = {
          ...prev,
          expenseCategoryTypes: upsertNamedRow(prev.expenseCategoryTypes, row),
        };
        queueMicrotask(() => {
          sectionSaveMutation.mutate({ nextForm, section: "expenseCategoryTypes" });
        });
        return nextForm;
      });
    },
    [sectionSaveMutation]
  );

  const upsertIncomeLineType = useCallback(
    (row: PropertyIncomeLineTypeFormRow) => {
      setForm((prev) => {
        const nextForm = {
          ...prev,
          incomeLineTypes: upsertNamedRow(prev.incomeLineTypes, row),
        };
        queueMicrotask(() => {
          sectionSaveMutation.mutate({ nextForm, section: "incomeLineTypes" });
        });
        return nextForm;
      });
    },
    [sectionSaveMutation]
  );

  const upsertTaxRate = useCallback(
    (row: PropertyTaxRateFormRow) => {
      setForm((prev) => {
        const nextForm = {
          ...prev,
          taxRates: upsertNamedRow(prev.taxRates, row),
        };
        queueMicrotask(() => {
          sectionSaveMutation.mutate({ nextForm, section: "taxRates" });
        });
        return nextForm;
      });
    },
    [sectionSaveMutation]
  );

  const upsertChannelCommission = useCallback(
    (row: PropertyChannelCommissionFormRow) => {
      setForm((prev) => {
        const nextForm = {
          ...prev,
          channelCommissions: upsertNamedRow(prev.channelCommissions, row),
        };
        queueMicrotask(() => {
          sectionSaveMutation.mutate({ nextForm, section: "channelCommissions" });
        });
        return nextForm;
      });
    },
    [sectionSaveMutation]
  );

  const removeExpenseCategory = useCallback(
    (clientId: string) => {
      setForm((prev) => {
        const nextForm = {
          ...prev,
          expenseCategoryTypes: prev.expenseCategoryTypes.filter(
            (row) => row.clientId !== clientId
          ),
        };
        queueMicrotask(() => {
          sectionSaveMutation.mutate({ nextForm, section: "expenseCategoryTypes" });
        });
        return nextForm;
      });
    },
    [sectionSaveMutation]
  );

  const removeIncomeLineType = useCallback(
    (clientId: string) => {
      setForm((prev) => {
        const nextForm = {
          ...prev,
          incomeLineTypes: prev.incomeLineTypes.filter((row) => row.clientId !== clientId),
        };
        queueMicrotask(() => {
          sectionSaveMutation.mutate({ nextForm, section: "incomeLineTypes" });
        });
        return nextForm;
      });
    },
    [sectionSaveMutation]
  );

  const removeTaxRate = useCallback(
    (clientId: string) => {
      setForm((prev) => {
        const nextForm = {
          ...prev,
          taxRates: prev.taxRates.filter((row) => row.clientId !== clientId),
        };
        queueMicrotask(() => {
          sectionSaveMutation.mutate({ nextForm, section: "taxRates" });
        });
        return nextForm;
      });
    },
    [sectionSaveMutation]
  );

  const removeChannelCommission = useCallback(
    (clientId: string) => {
      setForm((prev) => {
        const nextForm = {
          ...prev,
          channelCommissions: prev.channelCommissions.filter((row) => row.clientId !== clientId),
        };
        queueMicrotask(() => {
          sectionSaveMutation.mutate({ nextForm, section: "channelCommissions" });
        });
        return nextForm;
      });
    },
    [sectionSaveMutation]
  );

  const expenseDelete = usePropertySettingsListRowDelete({
    entityLabel: "expense category",
    isPending,
    onRemove: removeExpenseCategory,
  });

  const incomeDelete = usePropertySettingsListRowDelete({
    entityLabel: "income type",
    isPending,
    onRemove: removeIncomeLineType,
  });

  const taxDelete = usePropertySettingsListRowDelete({
    entityLabel: "tax rate",
    isPending,
    onRemove: removeTaxRate,
  });

  const channelDelete = usePropertySettingsListRowDelete({
    entityLabel: "channel",
    isPending,
    onRemove: removeChannelCommission,
  });

  const isQuickDeleteActive =
    expenseDelete.isQuickDeleteActive ||
    incomeDelete.isQuickDeleteActive ||
    taxDelete.isQuickDeleteActive ||
    channelDelete.isQuickDeleteActive;

  const taxDescription =
    totalTaxPercent === null
      ? "Applied to net room rate + cleaning fee for short-term stays."
      : `Applied to net room rate + cleaning fee for short-term stays. Total tax: ${totalTaxPercent.toFixed(1)}%`;

  const headerActions: ReactNode = useMemo(
    () =>
      canEdit ? (
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
      ) : undefined,
    [canEdit, isPending, resetMutation]
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
            Manage catalogs used for income and expenses. Changes save when you add or edit an item.
          </CardDescription>
          <p className="text-muted-foreground text-xs">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <UrlSyncedTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={PROPERTY_SETTINGS_TAB_DEFINITIONS}
          >
            <UrlSyncedTabsContent className="mt-4" value="expenses">
              <PropertyExpenseCategoriesCatalog
                disabled={!canEdit}
                expenseCategoryTypes={form.expenseCategoryTypes}
                isPending={isPending}
                isQuickDeleteActive={isQuickDeleteActive}
                onDeleteRow={expenseDelete.handleDelete}
                onUpsertRow={upsertExpenseCategory}
              />
            </UrlSyncedTabsContent>
            <UrlSyncedTabsContent className="mt-4" value="income">
              <PropertyIncomeLineTypesCatalog
                disabled={!canEdit}
                incomeLineTypes={form.incomeLineTypes}
                isPending={isPending}
                isQuickDeleteActive={isQuickDeleteActive}
                onDeleteRow={incomeDelete.handleDelete}
                onUpsertRow={upsertIncomeLineType}
              />
            </UrlSyncedTabsContent>
            <UrlSyncedTabsContent className="mt-4" value="taxes">
              <PropertyTaxRatesCatalog
                description={taxDescription}
                disabled={!canEdit}
                isPending={isPending}
                isQuickDeleteActive={isQuickDeleteActive}
                onDeleteRow={taxDelete.handleDelete}
                onUpsertRow={upsertTaxRate}
                taxRates={form.taxRates}
              />
            </UrlSyncedTabsContent>
            <UrlSyncedTabsContent className="mt-4" value="channels">
              <PropertyChannelCommissionsCatalog
                channelCommissions={form.channelCommissions}
                disabled={!canEdit}
                isPending={isPending}
                isQuickDeleteActive={isQuickDeleteActive}
                onDeleteRow={channelDelete.handleDelete}
                onUpsertRow={upsertChannelCommission}
              />
            </UrlSyncedTabsContent>
          </UrlSyncedTabs>
          {canEdit ? null : (
            <p className="text-muted-foreground mt-4 text-sm">
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
