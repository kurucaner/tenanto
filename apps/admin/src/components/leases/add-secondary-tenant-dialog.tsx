import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import type { IPropertyLongStay, IPropertyLongStaySecondaryTenant } from "@/packages/shared";

const MAX_SECONDARY_TENANTS = 10;

const addSecondaryTenantSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  tenantEmail: z.string(),
  tenantPhone: z.string(),
});

type TAddSecondaryTenantFormValues = z.infer<typeof addSecondaryTenantSchema>;

interface AddSecondaryTenantDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const AddSecondaryTenantDialog = memo(
  ({ lease, onOpenChange, open, propertyId }: AddSecondaryTenantDialogProps) => {
    const queryClient = useQueryClient();

    const form = useForm<TAddSecondaryTenantFormValues>({
      defaultValues: { name: "", tenantEmail: "", tenantPhone: "" },
      resolver: zodResolver(addSecondaryTenantSchema),
    });

    const mutation = useMutation({
      mutationFn: (values: TAddSecondaryTenantFormValues) => {
        if (lease.secondaryTenants.length >= MAX_SECONDARY_TENANTS) {
          throw new Error(`A lease can have at most ${MAX_SECONDARY_TENANTS} secondary tenants`);
        }

        const newTenant: IPropertyLongStaySecondaryTenant = {
          email: values.tenantEmail.trim() || null,
          name: values.name.trim(),
          phone: values.tenantPhone.trim() || null,
        };

        return longStaysApi.update(propertyId, lease.id, {
          secondaryTenants: [...lease.secondaryTenants, newTenant],
        });
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to add secondary tenant");
      },
      onSuccess: () => {
        toast.success("Secondary tenant added");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset({ name: "", tenantEmail: "", tenantPhone: "" });
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Secondary Tenant</DialogTitle>
            <DialogDescription>
              Add a partner or roommate to {lease.guestName}&apos;s lease.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="secondary-tenant-name">Name</Label>
                <Input autoFocus id="secondary-tenant-name" {...form.register("name")} />
                {errors.name ? (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="secondary-tenant-email">Email (optional)</Label>
                <Input id="secondary-tenant-email" type="email" {...form.register("tenantEmail")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="secondary-tenant-phone">Phone (optional)</Label>
                <Input id="secondary-tenant-phone" type="tel" {...form.register("tenantPhone")} />
              </div>
            </div>

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
                {mutation.isPending ? "Adding…" : "Add Tenant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
AddSecondaryTenantDialog.displayName = "AddSecondaryTenantDialog";
