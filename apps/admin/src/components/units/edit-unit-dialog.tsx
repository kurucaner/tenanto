import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

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
import { LayoutPicker } from "@/components/units/layout-picker";
import { RentalTypePicker } from "@/components/units/rental-type-picker";
import { unitsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { IPropertyUnit, TUnitRentalType } from "@/packages/shared";

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
        queryClient.invalidateQueries({ queryKey: queryKeys.propertyUnits(propertyId) });
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

          <DialogFormFields>
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

            <RentalTypePicker
              id="edit-unit-rental-type"
              onChange={setRentalType}
              value={rentalType}
            />
          </DialogFormFields>

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
