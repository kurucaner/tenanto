import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TenantContactFields } from "@/components/leases/tenant-contact-fields";
import {
  tenantContactFormDefaults,
  tenantContactFormSchema,
  toPrimaryTenantPatch,
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

interface EditPrimaryTenantDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const EditPrimaryTenantDialog = memo(
  ({ lease, onOpenChange, open, propertyId }: EditPrimaryTenantDialogProps) => {
    const queryClient = useQueryClient();

    const form = useForm<TTenantContactFormValues>({
      defaultValues: tenantContactFormDefaults({
        email: lease.tenantEmail,
        name: lease.guestName,
        phone: lease.tenantPhone,
      }),
      resolver: zodResolver(tenantContactFormSchema),
    });

    useEffect(() => {
      if (open) {
        form.reset(
          tenantContactFormDefaults({
            email: lease.tenantEmail,
            name: lease.guestName,
            phone: lease.tenantPhone,
          })
        );
      }
    }, [form, lease.guestName, lease.tenantEmail, lease.tenantPhone, open]);

    const mutation = useMutation({
      mutationFn: (values: TTenantContactFormValues) =>
        longStaysApi.update(propertyId, lease.id, toPrimaryTenantPatch(values)),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update primary tenant");
      },
      onSuccess: () => {
        toast.success("Primary tenant updated");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(
            tenantContactFormDefaults({
              email: lease.tenantEmail,
              name: lease.guestName,
              phone: lease.tenantPhone,
            })
          );
        }
        onOpenChange(nextOpen);
      },
      [form, lease.guestName, lease.tenantEmail, lease.tenantPhone, onOpenChange]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Primary Tenant</DialogTitle>
            <DialogDescription>Update the primary tenant&apos;s contact information.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4 px-6 py-5">
              <TenantContactFields
                errors={errors}
                idPrefix="primary-tenant"
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
EditPrimaryTenantDialog.displayName = "EditPrimaryTenantDialog";
