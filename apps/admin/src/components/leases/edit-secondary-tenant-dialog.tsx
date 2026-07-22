import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { EditLeaseTenantContactDialog } from "@/components/leases/edit-lease-tenant-contact-dialog";
import {
  createTenantContactFormSchema,
  getSecondaryTenantMutationErrorMessage,
  getTenantContactFormErrorMessage,
  toSecondaryOccupantPatch,
  type TTenantContactFormValues,
} from "@/components/leases/tenant-contact-form-schema";
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayDetailCaches } from "@/lib/invalidate-property-long-stay-caches";
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
  secondaryTenantEmails: readonly (string | null | undefined)[];
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
    secondaryTenantEmails,
  }: EditSecondaryTenantDialogProps) => {
    const queryClient = useQueryClient();

    const resolver = useMemo(
      () =>
        zodResolver(
          createTenantContactFormSchema({
            excludeEmail: contact.effectiveEmail,
            primaryTenantEmail,
            secondaryTenantEmails,
          })
        ),
      [contact.effectiveEmail, primaryTenantEmail, secondaryTenantEmails]
    );

    const mutation = useMutation({
      mutationFn: (values: TTenantContactFormValues) =>
        longStaysApi.updateSecondaryOccupant(
          propertyId,
          lease.id,
          membershipId,
          toSecondaryOccupantPatch(values)
        ),
      onError: (e) => {
        toast.error(getSecondaryTenantMutationErrorMessage(e, "Failed to update secondary tenant"));
      },
      onSuccess: () => {
        toast.success("Secondary tenant updated");
        invalidatePropertyLongStayDetailCaches(queryClient, propertyId, lease.id);
        onOpenChange(false);
      },
    });

    const handleSubmit = useCallback(
      (values: TTenantContactFormValues) => {
        mutation.mutate(values);
      },
      [mutation]
    );

    const handleInvalid = useCallback((fieldErrors: FieldErrors<TTenantContactFormValues>) => {
      toast.error(getTenantContactFormErrorMessage(fieldErrors));
    }, []);

    return (
      <EditLeaseTenantContactDialog
        contact={contact}
        description="Update this secondary tenant's contact information."
        emailDisabled={isPortalLinked}
        idPrefix="edit-secondary-tenant"
        isPending={mutation.isPending}
        onInvalid={handleInvalid}
        onOpenChange={onOpenChange}
        onSubmit={handleSubmit}
        open={open}
        resolver={resolver}
        title="Edit Secondary Tenant"
      />
    );
  }
);
EditSecondaryTenantDialog.displayName = "EditSecondaryTenantDialog";
