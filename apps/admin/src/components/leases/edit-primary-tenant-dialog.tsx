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
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { longStaysApi } from "@/lib/api-client";
import {
  invalidatePropertyLongStayCaches,
  invalidatePropertyLongStayDetailCaches,
} from "@/lib/invalidate-property-long-stay-caches";
import type { ILeasePrimaryTenantContact, IPropertyLongStay } from "@/packages/shared";

interface EditPrimaryTenantDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  primaryTenantContact: ILeasePrimaryTenantContact;
  propertyId: string;
}

function primaryTenantContactFormValues(
  primaryTenantContact: ILeasePrimaryTenantContact
): TTenantContactFormValues {
  return tenantContactFormDefaults({
    email: primaryTenantContact.effectiveEmail,
    name: primaryTenantContact.effectiveName,
    phone: primaryTenantContact.effectivePhone,
  });
}

export const EditPrimaryTenantDialog = memo(
  ({
    lease,
    onOpenChange,
    open,
    primaryTenantContact,
    propertyId,
  }: EditPrimaryTenantDialogProps) => {
    const queryClient = useQueryClient();
    const contactValues = primaryTenantContactFormValues(primaryTenantContact);

    const form = useForm<TTenantContactFormValues>({
      defaultValues: contactValues,
      resolver: zodResolver(tenantContactFormSchema),
    });

    useEffect(() => {
      if (open) {
        form.reset(primaryTenantContactFormValues(primaryTenantContact));
      }
    }, [form, open, primaryTenantContact]);

    const isPortalLinked = primaryTenantContact.source === "linked_user";

    const mutation = useMutation({
      mutationFn: (values: TTenantContactFormValues) =>
        longStaysApi.update(propertyId, lease.id, toPrimaryTenantPatch(values)),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update primary tenant");
      },
      onSuccess: () => {
        toast.success("Primary tenant updated");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        invalidatePropertyLongStayDetailCaches(queryClient, propertyId, lease.id);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(primaryTenantContactFormValues(primaryTenantContact));
        }
        onOpenChange(nextOpen);
      },
      [form, onOpenChange, primaryTenantContact]
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
            <DialogDescription>
              {isPortalLinked
                ? "Update the linked portal account contact. Email is read-only."
                : "Update the primary tenant's contact information."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <DialogFormFields>
              <TenantContactFields
                control={form.control}
                emailDisabled={isPortalLinked}
                errors={errors}
                idPrefix="primary-tenant"
                register={form.register}
              />
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
