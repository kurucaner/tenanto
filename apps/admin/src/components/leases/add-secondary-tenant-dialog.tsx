import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TenantContactFields } from "@/components/leases/tenant-contact-fields";
import {
  createTenantContactFormSchema,
  getSecondaryTenantMutationErrorMessage,
  getTenantContactFormErrorMessage,
  toSecondaryOccupantBody,
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
import {
  invalidatePropertyLongStayCaches,
  invalidatePropertyLongStayPortalCaches,
} from "@/lib/invalidate-property-long-stay-caches";
import { type IPropertyLongStay, MAX_SECONDARY_OCCUPANTS } from "@/packages/shared";

interface AddSecondaryTenantDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  primaryTenantEmail: string | null;
  propertyId: string;
  secondaryOccupantCount: number;
  secondaryTenantEmails: readonly (string | null | undefined)[];
}

export const AddSecondaryTenantDialog = memo(
  ({
    lease,
    onOpenChange,
    open,
    primaryTenantEmail,
    propertyId,
    secondaryOccupantCount,
    secondaryTenantEmails,
  }: AddSecondaryTenantDialogProps) => {
    const queryClient = useQueryClient();

    const form = useForm<TTenantContactFormValues>({
      defaultValues: { name: "", tenantEmail: "", tenantPhone: "" },
      resolver: zodResolver(
        createTenantContactFormSchema({
          primaryTenantEmail,
          secondaryTenantEmails,
        })
      ),
    });

    const mutation = useMutation({
      mutationFn: (values: TTenantContactFormValues) => {
        if (secondaryOccupantCount >= MAX_SECONDARY_OCCUPANTS) {
          throw new Error(`A lease can have at most ${MAX_SECONDARY_OCCUPANTS} secondary tenants`);
        }

        return longStaysApi.createSecondaryOccupant(
          propertyId,
          lease.id,
          toSecondaryOccupantBody(values)
        );
      },
      onError: (e) => {
        toast.error(getSecondaryTenantMutationErrorMessage(e, "Failed to add secondary tenant"));
      },
      onSuccess: () => {
        toast.success("Secondary tenant added");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        invalidatePropertyLongStayPortalCaches(queryClient, propertyId, lease.id);
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
