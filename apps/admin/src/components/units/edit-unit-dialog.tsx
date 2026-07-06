import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

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
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { IPropertyUnit, TUnitRentalType } from "@/packages/shared";
import { UnitRentalType } from "@/packages/shared";

const RENTAL_TYPE_OPTIONS: { label: string; value: TUnitRentalType }[] = [
  { label: "Short Term", value: UnitRentalType.SHORT_TERM },
  { label: "Long Term", value: UnitRentalType.LONG_TERM },
];

interface EditUnitDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  unit: IPropertyUnit;
}

export const EditUnitDialog = memo(
  ({ onOpenChange, open, propertyId, unit }: EditUnitDialogProps) => {
    const queryClient = useQueryClient();
    const [unitNumber, setUnitNumber] = useState(unit.unitNumber);
    const [layout, setLayout] = useState(unit.layout);
    const [rentalType, setRentalType] = useState<TUnitRentalType>(unit.rentalType);

    const mutation = useMutation({
      mutationFn: () =>
        unitsApi.update(propertyId, unit.id, {
          layout: layout.trim(),
          rentalType,
          unitNumber: unitNumber.trim(),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update unit");
      },
      onSuccess: () => {
        toast.success("Unit updated");
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.propertyUnits(propertyId) });
        onOpenChange(false);
      },
    });

    const canSubmit = unitNumber.trim() !== "" && layout.trim() !== "" && !mutation.isPending;

    return (
      <Dialog onOpenChange={() => onOpenChange(false)} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit Unit {unit.unitNumber}</DialogTitle>
            <DialogDescription>Update the details of this unit.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-unit-number">Unit Number</Label>
              <Input
                autoFocus
                id="edit-unit-number"
                onChange={(e) => setUnitNumber(e.target.value)}
                value={unitNumber}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Layout</Label>
              <LayoutPicker onChange={setLayout} value={layout} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-unit-rental-type">Rental Type</Label>
              <select
                className={cn(
                  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "dark:bg-input/30"
                )}
                id="edit-unit-rental-type"
                onChange={(e) => setRentalType(e.target.value as TUnitRentalType)}
                value={rentalType}
              >
                {RENTAL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
EditUnitDialog.displayName = "EditUnitDialog";
