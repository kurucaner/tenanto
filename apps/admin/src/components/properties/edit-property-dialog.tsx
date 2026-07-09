import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useState } from "react";
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
import { PhoneInput } from "@/components/ui/phone-input";
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
    const [legalName, setLegalName] = useState(property.legalName ?? "");
    const [address, setAddress] = useState(property.address);
    const [phoneNumber, setPhoneNumber] = useState(property.phoneNumber ?? "");

    useEffect(() => {
      if (open) {
        setName(property.name);
        setLegalName(property.legalName ?? "");
        setAddress(property.address);
        setPhoneNumber(property.phoneNumber ?? "");
      }
    }, [open, property]);

    const mutation = useMutation({
      mutationFn: () =>
        propertiesApi.update(property.id, {
          address: address.trim(),
          legalName: legalName.trim() || null,
          name: name.trim(),
          phoneNumber: phoneNumber.trim() || null,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update property");
      },
      onSuccess: (data) => {
        toast.success("Property updated");
        queryClient.invalidateQueries({ queryKey: ["properties"] });
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
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
            <DialogDescription>Update the details for this property.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-property-name">Name</Label>
                <Input
                  autoFocus
                  id="edit-property-name"
                  onChange={(e) => setName(e.target.value)}
                  required
                  value={name}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-property-legal-name">Legal Name</Label>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <Input
                  id="edit-property-legal-name"
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Sunset Apartments LLC"
                  value={legalName}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-property-address">Address</Label>
                <Input
                  id="edit-property-address"
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  value={address}
                />
              </div>
              <PhoneInput
                id="edit-property-phone"
                onChange={setPhoneNumber}
                optional
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
