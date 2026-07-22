import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { toast } from "sonner";

import { EditLeaseTenantContactDialog } from "@/components/leases/edit-lease-tenant-contact-dialog";
import {
  tenantContactFormSchema,
  toPrimaryTenantPatch,
  type TTenantContactFormValues,
} from "@/components/leases/tenant-contact-form-schema";
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayDetailQuery } from "@/lib/invalidate-property-long-stay-caches";
import type { ILeasePrimaryTenantContact, IPropertyLongStay } from "@/packages/shared";

interface EditPrimaryTenantDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  primaryTenantContact: ILeasePrimaryTenantContact;
  propertyId: string;
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
    const isPortalLinked = primaryTenantContact.source === "linked_user";

    const mutation = useMutation({
      mutationFn: (values: TTenantContactFormValues) =>
        longStaysApi.update(propertyId, lease.id, toPrimaryTenantPatch(values)),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update primary tenant");
      },
      onSuccess: () => {
        toast.success("Primary tenant updated");
        invalidatePropertyLongStayDetailQuery(queryClient, propertyId, lease.id);
        onOpenChange(false);
      },
    });

    const handleSubmit = useCallback(
      (values: TTenantContactFormValues) => {
        mutation.mutate(values);
      },
      [mutation]
    );

    return (
      <EditLeaseTenantContactDialog
        contact={primaryTenantContact}
        description={
          isPortalLinked
            ? "Update the linked portal account contact. Email is read-only."
            : "Update the primary tenant's contact information."
        }
        emailDisabled={isPortalLinked}
        idPrefix="primary-tenant"
        isPending={mutation.isPending}
        onOpenChange={onOpenChange}
        onSubmit={handleSubmit}
        open={open}
        resolver={zodResolver(tenantContactFormSchema)}
        title="Edit Primary Tenant"
      />
    );
  }
);
EditPrimaryTenantDialog.displayName = "EditPrimaryTenantDialog";
