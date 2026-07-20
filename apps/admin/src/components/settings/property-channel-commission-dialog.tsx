import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import {
  channelCommissionFormSchema,
  type TChannelCommissionFormValues,
} from "@/lib/property-settings-catalog-schemas";
import {
  createPropertySettingsClientId,
  type PropertyChannelCommissionFormRow,
} from "@/lib/property-settings-form-types";

type TPropertyChannelCommissionDialogProps = {
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (row: PropertyChannelCommissionFormRow) => void;
  open: boolean;
  row: PropertyChannelCommissionFormRow | null;
};

function getDefaultValues(
  row: PropertyChannelCommissionFormRow | null
): TChannelCommissionFormValues {
  return {
    excludeCleaningFromCommissionBase: row?.excludeCleaningFromCommissionBase ?? false,
    excludeResortTaxFromPayout: row?.excludeResortTaxFromPayout ?? false,
    name: row?.name ?? "",
    ratePercent: row?.ratePercent ?? "0",
  };
}

export const PropertyChannelCommissionDialog = memo(function PropertyChannelCommissionDialog({
  isPending = false,
  onOpenChange,
  onSubmit,
  open,
  row,
}: TPropertyChannelCommissionDialogProps) {
  const isEdit = row != null;
  const form = useForm<TChannelCommissionFormValues>({
    defaultValues: getDefaultValues(row),
    resolver: zodResolver(channelCommissionFormSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(row));
    }
  }, [form, open, row]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit({
      clientId: row?.clientId ?? createPropertySettingsClientId(),
      excludeCleaningFromCommissionBase: values.excludeCleaningFromCommissionBase,
      excludeResortTaxFromPayout: values.excludeResortTaxFromPayout,
      id: row?.id,
      name: values.name.trim(),
      ratePercent: values.ratePercent.trim(),
    });
  });

  let submitLabel = "Add channel";
  if (isPending) {
    submitLabel = "Saving…";
  } else if (isEdit) {
    submitLabel = "Save";
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit channel" : "Add channel"}</DialogTitle>
          <DialogDescription>
            Booking channel used when adding stays, with commission rate and payout rules.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogFormFields>
            <div className="space-y-2">
              <Label htmlFor="channel-name">Name</Label>
              <Input id="channel-name" {...form.register("name")} disabled={isPending} />
              {form.formState.errors.name ? (
                <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-rate">Commission rate</Label>
              <div className="relative">
                <Input
                  disabled={isPending}
                  id="channel-rate"
                  inputMode="decimal"
                  {...form.register("ratePercent", {
                    onChange: (event) => {
                      if (!isValidDecimalInput(event.target.value)) {
                        event.target.value = form.getValues("ratePercent");
                      }
                    },
                  })}
                />
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                  %
                </span>
              </div>
              {form.formState.errors.ratePercent ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.ratePercent.message}
                </p>
              ) : null}
            </div>
            <Controller
              control={form.control}
              name="excludeCleaningFromCommissionBase"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value}
                    disabled={isPending}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  Exclude cleaning from commission base
                </label>
              )}
            />
            <Controller
              control={form.control}
              name="excludeResortTaxFromPayout"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value}
                    disabled={isPending}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  Exclude resort tax from payout
                </label>
              )}
            />
          </DialogFormFields>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} type="submit">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
PropertyChannelCommissionDialog.displayName = "PropertyChannelCommissionDialog";
