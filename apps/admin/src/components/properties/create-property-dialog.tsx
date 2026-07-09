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
import { PhoneInput } from "@/components/ui/phone-input";
import { propertiesApi } from "@/lib/api-client";

interface CreatePropertyDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const CreatePropertyDialog = memo(({ onOpenChange, open }: CreatePropertyDialogProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      propertiesApi.create({
        address: address.trim(),
        legalName: legalName.trim() || undefined,
        name: name.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to create property");
    },
    onSuccess: () => {
      toast.success("Property created");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      onOpenChange(false);
      setName("");
      setLegalName("");
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
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Create Property</DialogTitle>
          <DialogDescription>
            Add a new property to the workspace. You can assign members after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-property-name">Name</Label>
              <Input
                autoFocus
                id="create-property-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunset Apartments"
                required
                value={name}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="create-property-legal-name">Legal Name</Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Input
                id="create-property-legal-name"
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Sunset Apartments LLC"
                value={legalName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-property-address">Address</Label>
              <Input
                id="create-property-address"
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Main St, City, State"
                required
                value={address}
              />
            </div>
            <PhoneInput
              id="create-property-phone"
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
