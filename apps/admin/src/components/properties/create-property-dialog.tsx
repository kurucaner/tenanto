import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
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

interface CreatePropertyDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const CreatePropertyDialog = memo(({ onOpenChange, open }: CreatePropertyDialogProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      propertiesApi.create({
        address: address.trim(),
        name: name.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to create property");
    },
    onSuccess: () => {
      toast.success("Property created");
      queryClient.invalidateQueries({ queryKey: ["admin", "properties"] });
      onOpenChange(false);
      setName("");
      setAddress("");
      setPhoneNumber("");
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
          <DialogTitle>Create Property</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-property-name">Name *</Label>
            <Input
              id="create-property-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunset Apartments"
              required
              value={name}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-property-address">Address *</Label>
            <Input
              id="create-property-address"
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, City, State"
              required
              value={address}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-property-phone">Phone Number</Label>
            <Input
              id="create-property-phone"
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
            <Button disabled={mutation.isPending || !name.trim() || !address.trim()} type="submit">
              {mutation.isPending ? "Creating…" : "Create Property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
CreatePropertyDialog.displayName = "CreatePropertyDialog";
