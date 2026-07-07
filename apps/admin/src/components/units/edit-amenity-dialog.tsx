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
import { adminQueryKeys } from "@/lib/query-keys";
import type { IPropertyUnit } from "@/packages/shared";

interface EditAmenityDialogProps {
  amenity: IPropertyUnit;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const EditAmenityDialog = memo(
  ({ amenity, onOpenChange, open, propertyId }: EditAmenityDialogProps) => {
    const queryClient = useQueryClient();
    const [name, setName] = useState(amenity.unitNumber);

    const mutation = useMutation({
      mutationFn: () =>
        unitsApi.update(propertyId, amenity.id, {
          unitNumber: name.trim(),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update amenity");
      },
      onSuccess: () => {
        toast.success("Amenity updated");
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.propertyUnits(propertyId) });
        onOpenChange(false);
      },
    });

    const canSubmit = name.trim() !== "" && !mutation.isPending;

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit Amenity</DialogTitle>
            <DialogDescription>Update the name of this property amenity.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-amenity-name">Amenity name</Label>
              <Input
                autoFocus
                id="edit-amenity-name"
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
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
EditAmenityDialog.displayName = "EditAmenityDialog";
