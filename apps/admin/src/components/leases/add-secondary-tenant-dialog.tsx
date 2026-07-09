import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TenantContactFields } from "@/components/leases/tenant-contact-fields";
import {
  tenantContactFormSchema,
  toSecondaryTenant,
  type TTenantContactFormValues,
} from "@/components/leases/tenant-contact-form-schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import type { IPropertyLongStay } from "@/packages/shared";

const MAX_SECONDARY_TENANTS = 10;

interface AddSecondaryTenantDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const AddSecondaryTenantDialog = memo(
  ({ lease, onOpenChange, open, propertyId }: AddSecondaryTenantDialogProps) => {
    const queryClient = useQueryClient();

    const form = useForm<TTenantContactFormValues>({
      defaultValues: { name: "", tenantEmail: "", tenantPhone: "" },
      resolver: zodResolver(tenantContactFormSchema),
    });

    const mutation = useMutation({
      mutationFn: (values: TTenantContactFormValues) => {
        if (lease.secondaryTenants.length >= MAX_SECONDARY_TENANTS) {
          throw new Error(`A lease can have at most ${MAX_SECONDARY_TENANTS} secondary tenants`);
        }

        return longStaysApi.update(propertyId, lease.id, {
          secondaryTenants: [...lease.secondaryTenants, toSecondaryTenant(values)],
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
              <TenantContactFields
                control={form.control}
                errors={errors}
                idPrefix="secondary-tenant"
                register={form.register}
              />
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
