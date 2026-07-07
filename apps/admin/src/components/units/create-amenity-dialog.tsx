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
import { unitsApi } from "@/lib/api-client";
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { UnitKind } from "@/packages/shared";

interface CreateAmenityDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateAmenityDialog = memo(
  ({ onOpenChange, open, propertyId }: CreateAmenityDialogProps) => {
    const queryClient = useQueryClient();
    const [name, setName] = useState("");

    const mutation = useMutation({
      mutationFn: () =>
        unitsApi.create(propertyId, {
          unitKind: UnitKind.AMENITY,
          unitNumber: name.trim(),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create amenity");
      },
      onSuccess: () => {
        toast.success("Amenity created");
        invalidatePropertyUnitCaches(queryClient, propertyId);
        handleClose();
      },
    });

    const handleClose = () => {
      onOpenChange(false);
      setName("");
    };

    const canSubmit = name.trim() !== "" && !mutation.isPending;

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Amenity</DialogTitle>
            <DialogDescription>
              Add a shared property facility for tracking amenity income, such as a laundry room.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amenity-name">Amenity name</Label>
              <Input
                autoFocus
                id="amenity-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Laundry Room"
                value={name}
              />
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
              {mutation.isPending ? "Creating…" : "Add Amenity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateAmenityDialog.displayName = "CreateAmenityDialog";
