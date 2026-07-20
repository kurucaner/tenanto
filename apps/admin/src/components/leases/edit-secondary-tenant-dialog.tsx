import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TenantContactFields } from "@/components/leases/tenant-contact-fields";
import {
  createTenantContactFormSchema,
  getTenantContactFormErrorMessage,
  tenantContactFormDefaults,
  toSecondaryOccupantPatch,
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
  invalidatePropertyLongStayPortalCaches,
} from "@/lib/invalidate-property-long-stay-caches";
import { type ILeaseSecondaryTenantContact, type IPropertyLongStay } from "@/packages/shared";

interface EditSecondaryTenantDialogProps {
  contact: ILeaseSecondaryTenantContact;
  isPortalLinked: boolean;
  lease: IPropertyLongStay;
  membershipId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  primaryTenantEmail: string | null;
  propertyId: string;
}

export const EditSecondaryTenantDialog = memo(
  ({
    contact,
    isPortalLinked,
    lease,
    membershipId,
    onOpenChange,
    open,
    primaryTenantEmail,
    propertyId,
  }: EditSecondaryTenantDialogProps) => {
    const queryClient = useQueryClient();

    const form = useForm<TTenantContactFormValues>({
      defaultValues: tenantContactFormDefaults({
        email: contact.effectiveEmail,
        name: contact.effectiveName,
        phone: contact.effectivePhone,
      }),
      resolver: zodResolver(
        createTenantContactFormSchema({ blockedEmails: [primaryTenantEmail] })
      ),
    });

    useEffect(() => {
      if (open) {
        form.reset(
          tenantContactFormDefaults({
            email: contact.effectiveEmail,
            name: contact.effectiveName,
            phone: contact.effectivePhone,
          })
        );
      }
    }, [contact.effectiveEmail, contact.effectiveName, contact.effectivePhone, form, open]);

    const mutation = useMutation({
      mutationFn: (values: TTenantContactFormValues) =>
        longStaysApi.updateSecondaryOccupant(
          propertyId,
          lease.id,
          membershipId,
          toSecondaryOccupantPatch(values)
        ),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update secondary tenant");
      },
      onSuccess: () => {
        toast.success("Secondary tenant updated");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        invalidatePropertyLongStayPortalCaches(queryClient, propertyId, lease.id);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(
            tenantContactFormDefaults({
              email: contact.effectiveEmail,
              name: contact.effectiveName,
              phone: contact.effectivePhone,
            })
          );
        }
        onOpenChange(nextOpen);
      },
      [contact.effectiveEmail, contact.effectiveName, contact.effectivePhone, form, onOpenChange]
    );

    const onSubmit = form.handleSubmit(
      (values) => {
        mutation.mutate(values);
      },
      (fieldErrors) => {
        toast.error(getTenantContactFormErrorMessage(fieldErrors));
      }
    );

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Secondary Tenant</DialogTitle>
            <DialogDescription>
              Update this secondary tenant&apos;s contact information.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <DialogFormFields>
              <TenantContactFields
                control={form.control}
                emailDisabled={isPortalLinked}
                errors={errors}
                idPrefix="edit-secondary-tenant"
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
EditSecondaryTenantDialog.displayName = "EditSecondaryTenantDialog";
