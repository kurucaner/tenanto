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
import {
  expenseCategoryFormSchema,
  type TExpenseCategoryFormValues,
} from "@/lib/property-settings-catalog-schemas";
import {
  createPropertySettingsClientId,
  type PropertyExpenseCategoryTypeFormRow,
} from "@/lib/property-settings-form-types";

type TPropertyExpenseCategoryDialogProps = {
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (row: PropertyExpenseCategoryTypeFormRow) => void;
  open: boolean;
  row: PropertyExpenseCategoryTypeFormRow | null;
};

function getDefaultValues(
  row: PropertyExpenseCategoryTypeFormRow | null
): TExpenseCategoryFormValues {
  return {
    isAnnualAmount: row?.isAnnualAmount ?? false,
    name: row?.name ?? "",
  };
}

export const PropertyExpenseCategoryDialog = memo(function PropertyExpenseCategoryDialog({
  isPending = false,
  onOpenChange,
  onSubmit,
  open,
  row,
}: TPropertyExpenseCategoryDialogProps) {
  const isEdit = row != null;
  const form = useForm<TExpenseCategoryFormValues>({
    defaultValues: getDefaultValues(row),
    resolver: zodResolver(expenseCategoryFormSchema),
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
      isAnnualAmount: values.isAnnualAmount,
      name: values.name.trim(),
    });
  });

  let submitLabel = "Add category";
  if (isPending) {
    submitLabel = "Saving…";
  } else if (isEdit) {
    submitLabel = "Save";
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense category" : "Add expense category"}</DialogTitle>
          <DialogDescription>
            Categories available when adding expenses. Annual categories are spread across months in
            reports.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogFormFields>
            <div className="space-y-2">
              <Label htmlFor="expense-category-name">Name</Label>
              <Input id="expense-category-name" {...form.register("name")} disabled={isPending} />
              {form.formState.errors.name ? (
                <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <Controller
              control={form.control}
              name="isAnnualAmount"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value}
                    disabled={isPending}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  Annual amount (spread across months in reports)
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
PropertyExpenseCategoryDialog.displayName = "PropertyExpenseCategoryDialog";
