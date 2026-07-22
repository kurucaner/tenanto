import { memo, useCallback, useEffect } from "react";
import { type FieldErrors, type Resolver, useForm } from "react-hook-form";

import { TenantContactFields } from "@/components/leases/tenant-contact-fields";
import {
  isLeaseTenantContactUnchanged,
  tenantContactFormDefaults,
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

export type TLeaseTenantContactSnapshot = {
  effectiveEmail: string | null;
  effectiveName: string;
  effectivePhone: string | null;
};

interface EditLeaseTenantContactDialogProps {
  contact: TLeaseTenantContactSnapshot;
  description: string;
  emailDisabled?: boolean;
  idPrefix: string;
  isPending: boolean;
  onInvalid?: (errors: FieldErrors<TTenantContactFormValues>) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TTenantContactFormValues) => void;
  open: boolean;
  resolver: Resolver<TTenantContactFormValues>;
  title: string;
}

function contactFormValues(contact: TLeaseTenantContactSnapshot): TTenantContactFormValues {
  return tenantContactFormDefaults({
    email: contact.effectiveEmail,
    name: contact.effectiveName,
    phone: contact.effectivePhone,
  });
}

export const EditLeaseTenantContactDialog = memo(
  ({
    contact,
    description,
    emailDisabled = false,
    idPrefix,
    isPending,
    onInvalid,
    onOpenChange,
    onSubmit,
    open,
    resolver,
    title,
  }: EditLeaseTenantContactDialogProps) => {
    const form = useForm<TTenantContactFormValues>({
      defaultValues: contactFormValues(contact),
      resolver,
    });

    useEffect(() => {
      if (open) {
        form.reset(contactFormValues(contact));
      }
    }, [contact, form, open]);

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(contactFormValues(contact));
        }
        onOpenChange(nextOpen);
      },
      [contact, form, onOpenChange]
    );

    const handleSubmit = form.handleSubmit(
      (values) => {
        if (isLeaseTenantContactUnchanged(values, contact)) {
          handleOpenChange(false);
          return;
        }
        onSubmit(values);
      },
      (fieldErrors) => {
        onInvalid?.(fieldErrors);
      }
    );

    const { errors, isDirty, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <DialogFormFields>
              <TenantContactFields
                control={form.control}
                emailDisabled={emailDisabled}
                errors={errors}
                idPrefix={idPrefix}
                register={form.register}
              />
            </DialogFormFields>

            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending || isSubmitting || !isDirty} type="submit">
                {isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
EditLeaseTenantContactDialog.displayName = "EditLeaseTenantContactDialog";
