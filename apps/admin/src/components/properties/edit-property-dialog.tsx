import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { propertiesApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IProperty } from "@/packages/shared";

interface EditPropertyDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  property: IProperty;
}

export const EditPropertyDialog = memo(
  ({ onOpenChange, open, property }: EditPropertyDialogProps) => {
    const queryClient = useQueryClient();
    const [name, setName] = useState(property.name);
    const [address, setAddress] = useState(property.address);
    const [phoneNumber, setPhoneNumber] = useState(property.phoneNumber ?? "");

    useEffect(() => {
      if (open) {
        setName(property.name);
        setAddress(property.address);
        setPhoneNumber(property.phoneNumber ?? "");
      }
    }, [open, property]);

    const mutation = useMutation({
      mutationFn: () =>
        propertiesApi.update(property.id, {
          address: address.trim(),
          name: name.trim(),
          phoneNumber: phoneNumber.trim() || null,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update property");
      },
      onSuccess: (data) => {
        toast.success("Property updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "properties"] });
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.propertyDetail(property.id),
        });
        queryClient.setQueryData(adminQueryKeys.propertyDetail(property.id), {
          property: { ...data.property, members: [] },
        });
        onOpenChange(false);
      },
    });

    const handleSubmit = (e: { preventDefault(): void }) => {
      e.preventDefault();
      mutation.mutate();
    };

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-property-name">Name *</Label>
              <Input
                id="edit-property-name"
                onChange={(e) => setName(e.target.value)}
                required
                value={name}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-property-address">Address *</Label>
              <Input
                id="edit-property-address"
                onChange={(e) => setAddress(e.target.value)}
                required
                value={address}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-property-phone">Phone Number</Label>
              <Input
                id="edit-property-phone"
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +1 (555) 000-0000"
                type="tel"
                value={phoneNumber}
              />
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
              <Button
                disabled={mutation.isPending || !name.trim() || !address.trim()}
                type="submit"
              >
                {mutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
EditPropertyDialog.displayName = "EditPropertyDialog";
