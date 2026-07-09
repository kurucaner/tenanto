import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TenantContactFields } from "@/components/leases/tenant-contact-fields";
import {
  tenantContactFormDefaults,
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
import type { IPropertyLongStay, IPropertyLongStaySecondaryTenant } from "@/packages/shared";

interface EditSecondaryTenantDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  tenant: IPropertyLongStaySecondaryTenant;
  tenantIndex: number;
}

export const EditSecondaryTenantDialog = memo(
  ({
    lease,
    onOpenChange,
    open,
    propertyId,
    tenant,
    tenantIndex,
  }: EditSecondaryTenantDialogProps) => {
    const queryClient = useQueryClient();

    const form = useForm<TTenantContactFormValues>({
      defaultValues: tenantContactFormDefaults({
        email: tenant.email,
        name: tenant.name,
        phone: tenant.phone,
      }),
      resolver: zodResolver(tenantContactFormSchema),
    });

    useEffect(() => {
      if (open) {
        form.reset(
          tenantContactFormDefaults({
            email: tenant.email,
            name: tenant.name,
            phone: tenant.phone,
          })
        );
      }
    }, [form, open, tenant.email, tenant.name, tenant.phone]);

    const mutation = useMutation({
      mutationFn: (values: TTenantContactFormValues) => {
        const nextTenants = lease.secondaryTenants.map((item, index) =>
          index === tenantIndex ? toSecondaryTenant(values) : item
        );
        return longStaysApi.update(propertyId, lease.id, {
          secondaryTenants: nextTenants,
        });
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update secondary tenant");
      },
      onSuccess: () => {
        toast.success("Secondary tenant updated");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(
            tenantContactFormDefaults({
              email: tenant.email,
              name: tenant.name,
              phone: tenant.phone,
            })
          );
        }
        onOpenChange(nextOpen);
      },
      [form, onOpenChange, tenant.email, tenant.name, tenant.phone]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Secondary Tenant</DialogTitle>
            <DialogDescription>Update this secondary tenant&apos;s contact information.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4 px-6 py-5">
              <TenantContactFields
                control={form.control}
                errors={errors}
                idPrefix="edit-secondary-tenant"
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
                {mutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
EditSecondaryTenantDialog.displayName = "EditSecondaryTenantDialog";
