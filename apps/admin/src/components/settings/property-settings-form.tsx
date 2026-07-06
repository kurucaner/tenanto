import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { memo, type ReactNode,useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { settingsApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  DEFAULT_PROPERTY_SETTINGS,
  formatRateAsPercent,
  type IPropertySettings,
  percentToRate,
} from "@/packages/shared";

type TSettingsFormState = {
  airbnbCommissionRate: string;
  bookingCommissionRate: string;
  conventionDevelopmentTaxRate: string;
  directCommissionRate: string;
  expediaCommissionRate: string;
  miamiDadeSurtaxRate: string;
  resortTaxRate: string;
  salesTaxRate: string;
};

const settingsToFormState = (settings: IPropertySettings): TSettingsFormState => ({
  airbnbCommissionRate: formatRateAsPercent(settings.airbnbCommissionRate),
  bookingCommissionRate: formatRateAsPercent(settings.bookingCommissionRate),
  conventionDevelopmentTaxRate: formatRateAsPercent(settings.conventionDevelopmentTaxRate),
  directCommissionRate: formatRateAsPercent(settings.directCommissionRate),
  expediaCommissionRate: formatRateAsPercent(settings.expediaCommissionRate),
  miamiDadeSurtaxRate: formatRateAsPercent(settings.miamiDadeSurtaxRate),
  resortTaxRate: formatRateAsPercent(settings.resortTaxRate),
  salesTaxRate: formatRateAsPercent(settings.salesTaxRate),
});

const formStateToBody = (form: TSettingsFormState) => ({
  airbnbCommissionRate: percentToRate(Number(form.airbnbCommissionRate)),
  bookingCommissionRate: percentToRate(Number(form.bookingCommissionRate)),
  conventionDevelopmentTaxRate: percentToRate(Number(form.conventionDevelopmentTaxRate)),
  directCommissionRate: percentToRate(Number(form.directCommissionRate)),
  expediaCommissionRate: percentToRate(Number(form.expediaCommissionRate)),
  miamiDadeSurtaxRate: percentToRate(Number(form.miamiDadeSurtaxRate)),
  resortTaxRate: percentToRate(Number(form.resortTaxRate)),
  salesTaxRate: percentToRate(Number(form.salesTaxRate)),
});

const parsePercent = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
};

interface PercentFieldProps {
  disabled: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}

const PercentField = memo(({ disabled, id, label, onChange, value }: PercentFieldProps) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input
        disabled={disabled}
        id={id}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        type="text"
        value={value}
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
        %
      </span>
    </div>
  </div>
));
PercentField.displayName = "PercentField";

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
    const values = [
      parsePercent(form.salesTaxRate),
      parsePercent(form.miamiDadeSurtaxRate),
      parsePercent(form.conventionDevelopmentTaxRate),
      parsePercent(form.resortTaxRate),
    ];
    let total = 0;
    for (const value of values) {
      if (value === null) return null;
      total += value;
    }
    return total;
  }, [form]);

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
    mutationFn: () => settingsApi.update(propertyId, DEFAULT_PROPERTY_SETTINGS),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    },
    onSuccess: (res) => {
      toast.success("Settings reset to defaults");
      queryClient.setQueryData(adminQueryKeys.propertySettings(propertyId), res);
      setForm(settingsToFormState(res.settings));
    },
  });

  const updateField = (field: keyof TSettingsFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const fields = Object.values(form);
    if (fields.some((v) => parsePercent(v) === null)) {
      toast.error("All rates must be numbers between 0 and 100");
      return;
    }
    saveMutation.mutate();
  };

  const isPending = saveMutation.isPending || resetMutation.isPending;

  const headerActions: ReactNode = canEdit ? (
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
  ) : undefined;

  const formContent = (
    <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="text-muted-foreground size-4" />
          <CardTitle className="text-lg">Property settings</CardTitle>
        </div>
        <CardDescription>
          Tax and channel commission rates used for short-term income calculations.
        </CardDescription>
        <p className="text-muted-foreground text-xs">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
        </p>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-8 pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium">Tax rates</h3>
            <p className="text-muted-foreground text-xs">
              Applied to net room rate + cleaning fee for short-term stays.
              {totalTaxPercent !== null ? (
                <> Total tax: {totalTaxPercent.toFixed(1)}%</>
              ) : (
                <> Enter valid percentages to see total.</>
              )}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PercentField
              disabled={!canEdit || isPending}
              id="sales-tax"
              label="Sales tax"
              onChange={(v) => updateField("salesTaxRate", v)}
              value={form.salesTaxRate}
            />
            <PercentField
              disabled={!canEdit || isPending}
              id="miami-dade-surtax"
              label="Miami-Dade surtax"
              onChange={(v) => updateField("miamiDadeSurtaxRate", v)}
              value={form.miamiDadeSurtaxRate}
            />
            <PercentField
              disabled={!canEdit || isPending}
              id="cdt"
              label="Convention development tax (CDT)"
              onChange={(v) => updateField("conventionDevelopmentTaxRate", v)}
              value={form.conventionDevelopmentTaxRate}
            />
            <PercentField
              disabled={!canEdit || isPending}
              id="resort-tax"
              label="Resort tax"
              onChange={(v) => updateField("resortTaxRate", v)}
              value={form.resortTaxRate}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium">Channel commissions</h3>
            <p className="text-muted-foreground text-xs">
              Applied to net room rate + cleaning fee based on booking channel.
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
            <PercentField
              disabled={!canEdit || isPending}
              id="expedia-commission"
              label="Expedia"
              onChange={(v) => updateField("expediaCommissionRate", v)}
              value={form.expediaCommissionRate}
            />
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
