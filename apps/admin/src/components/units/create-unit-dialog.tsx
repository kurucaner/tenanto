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
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { cn } from "@/lib/utils";
import { type TUnitRentalType, UnitRentalType } from "@/packages/shared";

const RENTAL_TYPE_OPTIONS: { label: string; value: TUnitRentalType }[] = [
  { label: "Short Term", value: UnitRentalType.SHORT_TERM },
  { label: "Long Term", value: UnitRentalType.LONG_TERM },
];

interface CreateUnitDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateUnitDialog = memo(
  ({ onOpenChange, open, propertyId }: CreateUnitDialogProps) => {
    const queryClient = useQueryClient();
    const [unitNumber, setUnitNumber] = useState("");
    const [layout, setLayout] = useState("");
    const [rentalType, setRentalType] = useState<TUnitRentalType>(UnitRentalType.SHORT_TERM);

    const mutation = useMutation({
      mutationFn: () =>
        unitsApi.create(propertyId, {
          layout: layout.trim(),
          rentalType,
          unitNumber: unitNumber.trim(),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create unit");
      },
      onSuccess: () => {
        toast.success("Unit created");
        invalidatePropertyUnitCaches(queryClient, propertyId);
        handleClose();
      },
    });

    const handleClose = () => {
      onOpenChange(false);
      setUnitNumber("");
      setLayout("");
      setRentalType(UnitRentalType.SHORT_TERM);
    };

    const canSubmit = unitNumber.trim() !== "" && layout.trim() !== "" && !mutation.isPending;

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Unit</DialogTitle>
            <DialogDescription>Add a room or apartment unit to this property.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit-number">Unit Number</Label>
              <Input
                autoFocus
                id="unit-number"
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. 101, 202"
                value={unitNumber}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Layout</Label>
              <LayoutPicker onChange={setLayout} value={layout} />
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
              onClick={handleClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
              {mutation.isPending ? "Creating…" : "Add Unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateUnitDialog.displayName = "CreateUnitDialog";
