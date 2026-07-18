import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
  taxRateFormSchema,
  type TTaxRateFormValues,
} from "@/lib/property-settings-catalog-schemas";
import {
  createPropertySettingsClientId,
  type PropertyTaxRateFormRow,
} from "@/lib/property-settings-form-types";

type TPropertyTaxRateDialogProps = {
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (row: PropertyTaxRateFormRow) => void;
  open: boolean;
  row: PropertyTaxRateFormRow | null;
};

function getDefaultValues(row: PropertyTaxRateFormRow | null): TTaxRateFormValues {
  return {
    name: row?.name ?? "",
    ratePercent: row?.ratePercent ?? "0",
  };
}

export const PropertyTaxRateDialog = memo(function PropertyTaxRateDialog({
  isPending = false,
  onOpenChange,
  onSubmit,
  open,
  row,
}: TPropertyTaxRateDialogProps) {
  const isEdit = row != null;
  const form = useForm<TTaxRateFormValues>({
    defaultValues: getDefaultValues(row),
    resolver: zodResolver(taxRateFormSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(row));
    }
  }, [form, open, row]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit({
      clientId: row?.clientId ?? createPropertySettingsClientId(),
      id: row?.id,
      name: values.name.trim(),
      ratePercent: values.ratePercent.trim(),
    });
  });

  let submitLabel = "Add tax";
  if (isPending) {
    submitLabel = "Saving…";
  } else if (isEdit) {
    submitLabel = "Save";
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit tax rate" : "Add tax rate"}</DialogTitle>
          <DialogDescription>
            Applied to net room rate + cleaning fee for short-term stays.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogFormFields>
            <div className="space-y-2">
              <Label htmlFor="tax-name">Name</Label>
              <Input id="tax-name" {...form.register("name")} disabled={isPending} />
              {form.formState.errors.name ? (
                <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Rate</Label>
              <div className="relative">
                <Input
                  disabled={isPending}
                  id="tax-rate"
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
PropertyTaxRateDialog.displayName = "PropertyTaxRateDialog";
