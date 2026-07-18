import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  incomeLineTypeFormSchema,
  type TIncomeLineTypeFormValues,
} from "@/lib/property-settings-catalog-schemas";
import {
  createPropertySettingsClientId,
  type PropertyIncomeLineTypeFormRow,
} from "@/lib/property-settings-form-types";

type TPropertyIncomeLineTypeDialogProps = {
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (row: PropertyIncomeLineTypeFormRow) => void;
  open: boolean;
  row: PropertyIncomeLineTypeFormRow | null;
};

function getDefaultValues(row: PropertyIncomeLineTypeFormRow | null): TIncomeLineTypeFormValues {
  return {
    name: row?.name ?? "",
  };
}

export const PropertyIncomeLineTypeDialog = memo(function PropertyIncomeLineTypeDialog({
  isPending = false,
  onOpenChange,
  onSubmit,
  open,
  row,
}: TPropertyIncomeLineTypeDialogProps) {
  const isEdit = row != null;
  const form = useForm<TIncomeLineTypeFormValues>({
    defaultValues: getDefaultValues(row),
    resolver: zodResolver(incomeLineTypeFormSchema),
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
    });
  });

  let submitLabel = "Add income type";
  if (isPending) {
    submitLabel = "Saving…";
  } else if (isEdit) {
    submitLabel = "Save";
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit income type" : "Add income type"}</DialogTitle>
          <DialogDescription>
            Types available when adding other income and filtering the income table.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="income-type-name">Name</Label>
            <Input id="income-type-name" {...form.register("name")} disabled={isPending} />
            {form.formState.errors.name ? (
              <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
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
PropertyIncomeLineTypeDialog.displayName = "PropertyIncomeLineTypeDialog";
