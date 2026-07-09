import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { LayoutPicker } from "@/components/units/layout-picker";
import { unitsApi } from "@/lib/api-client";
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { cn } from "@/lib/utils";
import { type TUnitRentalType, UnitRentalType } from "@/packages/shared";

const RENTAL_TYPE_OPTIONS: { label: string; value: TUnitRentalType }[] = [
  { label: "Short Term", value: UnitRentalType.SHORT_TERM },
  { label: "Long Term", value: UnitRentalType.LONG_TERM },
];

const createUnitSchema = z.object({
  layout: z.string().trim().min(1, "Layout is required"),
  rentalType: z.enum([UnitRentalType.SHORT_TERM, UnitRentalType.LONG_TERM], {
    message: "Rental type is required",
  }),
  unitNumber: z.string().trim().min(1, "Unit number is required"),
});

type TCreateUnitFormValues = z.infer<typeof createUnitSchema>;

function getDefaultValues(): TCreateUnitFormValues {
  return {
    layout: "",
    rentalType: UnitRentalType.SHORT_TERM,
    unitNumber: "",
  };
}

interface CreateUnitDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateUnitDialog = memo(
  ({ onOpenChange, open, propertyId }: CreateUnitDialogProps) => {
    const queryClient = useQueryClient();
    const form = useForm<TCreateUnitFormValues>({
      defaultValues: getDefaultValues(),
      resolver: zodResolver(createUnitSchema),
    });

    const mutation = useMutation({
      mutationFn: (values: TCreateUnitFormValues) =>
        unitsApi.create(propertyId, {
          layout: values.layout.trim(),
          rentalType: values.rentalType,
          unitNumber: values.unitNumber.trim(),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create unit");
      },
      onSuccess: () => {
        toast.success("Unit created");
        invalidatePropertyUnitCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(getDefaultValues());
        }
        onOpenChange(nextOpen);
      },
      [form, onOpenChange]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Unit</DialogTitle>
            <DialogDescription>Add a room or apartment unit to this property.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit-number">Unit Number</Label>
                <Input
                  autoFocus
                  id="unit-number"
                  placeholder="e.g. 101, 202"
                  {...form.register("unitNumber")}
                />
                {errors.unitNumber ? (
                  <p className="text-xs text-destructive">{errors.unitNumber.message}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Layout</Label>
                <Controller
                  control={form.control}
                  name="layout"
                  render={({ field }) => (
                    <LayoutPicker onChange={field.onChange} value={field.value} />
                  )}
                />
                {errors.layout ? (
                  <p className="text-xs text-destructive">{errors.layout.message}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit-rental-type">Rental Type</Label>
                <select
                  className={cn(
                    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30"
                  )}
                  id="unit-rental-type"
                  {...form.register("rentalType")}
                >
                  {RENTAL_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.rentalType ? (
                  <p className="text-xs text-destructive">{errors.rentalType.message}</p>
                ) : null}
              </div>
            </div>

            <DialogFooter>
              <Button
                disabled={mutation.isPending}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={mutation.isPending || isSubmitting} type="submit">
                {mutation.isPending ? "Creating…" : "Add Unit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateUnitDialog.displayName = "CreateUnitDialog";
