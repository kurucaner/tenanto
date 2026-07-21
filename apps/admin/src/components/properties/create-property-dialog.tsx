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
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { propertiesApi } from "@/lib/api-client";
import { PhoneInput } from "@/packages/app-ui";
import { isValidE164 } from "@/packages/shared";

const createPropertySchema = z.object({
  address: z.string().trim().min(1, "Address is required"),
  legalName: z.string(),
  name: z.string().trim().min(1, "Name is required"),
  phoneNumber: z.string().refine((value) => isValidE164(value.trim()), {
    message: "Enter a valid phone number",
  }),
});

type TCreatePropertyFormValues = z.infer<typeof createPropertySchema>;

function getDefaultValues(): TCreatePropertyFormValues {
  return {
    address: "",
    legalName: "",
    name: "",
    phoneNumber: "",
  };
}

interface CreatePropertyDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const CreatePropertyDialog = memo(({ onOpenChange, open }: CreatePropertyDialogProps) => {
  const queryClient = useQueryClient();
  const form = useForm<TCreatePropertyFormValues>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(createPropertySchema),
  });

  const mutation = useMutation({
    mutationFn: (values: TCreatePropertyFormValues) =>
      propertiesApi.create({
        address: values.address.trim(),
        legalName: values.legalName.trim() || undefined,
        name: values.name.trim(),
        phoneNumber: values.phoneNumber.trim() || undefined,
      }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to create property");
    },
    onSuccess: () => {
      toast.success("Property created");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
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
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Create Property</DialogTitle>
          <DialogDescription>
            Add a new property to the workspace. You can assign members after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogFormFields>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-property-name">Name</Label>
              <Input
                autoFocus
                id="create-property-name"
                placeholder="e.g. Sunset Apartments"
                {...form.register("name")}
              />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="create-property-legal-name" optional>
                Legal Name
              </FieldLabel>
              <Input
                id="create-property-legal-name"
                placeholder="e.g. Sunset Apartments LLC"
                {...form.register("legalName")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-property-address">Address</Label>
              <Input
                id="create-property-address"
                placeholder="e.g. 123 Main St, City, State"
                {...form.register("address")}
              />
              {errors.address ? (
                <p className="text-xs text-destructive">{errors.address.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Controller
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <PhoneInput
                    id="create-property-phone"
                    onChange={field.onChange}
                    optional
                    value={field.value}
                  />
                )}
              />
              {errors.phoneNumber ? (
                <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>
              ) : null}
            </div>
          </DialogFormFields>
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
              {mutation.isPending ? "Creating…" : "Create Property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
CreatePropertyDialog.displayName = "CreatePropertyDialog";
