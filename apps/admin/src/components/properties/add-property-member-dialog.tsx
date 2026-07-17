import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { propertiesApi } from "@/lib/api-client";
import { handlePropertyMemberInviteMutationSuccess } from "@/lib/property-member-invite-mutation-toast";
import { queryKeys } from "@/lib/query-keys";
import { authEmailSchema } from "@/packages/app-ui";
import { PropertyRole, type TPropertyRole } from "@/packages/shared";

const ROLE_OPTIONS: { label: string; value: TPropertyRole }[] = [
  { label: "Owner", value: PropertyRole.OWNER },
  { label: "Manager", value: PropertyRole.MANAGER },
  { label: "Accountant", value: PropertyRole.ACCOUNTANT },
];

const addPropertyMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(authEmailSchema)
    .transform((value) => value.toLowerCase()),
  role: z.enum([PropertyRole.OWNER, PropertyRole.MANAGER, PropertyRole.ACCOUNTANT]),
});

type TAddPropertyMemberFormValues = z.infer<typeof addPropertyMemberSchema>;

function getDefaultValues(): TAddPropertyMemberFormValues {
  return {
    email: "",
    role: PropertyRole.OWNER,
  };
}

interface AddPropertyMemberDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const AddPropertyMemberDialog = memo(
  ({ onOpenChange, open, propertyId }: AddPropertyMemberDialogProps) => {
    const queryClient = useQueryClient();
    const form = useForm<TAddPropertyMemberFormValues>({
      defaultValues: getDefaultValues(),
      resolver: zodResolver(addPropertyMemberSchema),
    });

    const mutation = useMutation({
      mutationFn: (values: TAddPropertyMemberFormValues) =>
        propertiesApi.addMember(propertyId, values),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to add member");
      },
      onSuccess: (data) => {
        if (data.type === "invite_sent") {
          handlePropertyMemberInviteMutationSuccess(`Invitation sent to ${data.invite.email}`);
        } else {
          handlePropertyMemberInviteMutationSuccess("Invitation saved but email failed to send", {
            emailError: data.invite.emailError ?? "Unknown error",
            emailSent: false,
          });
        }
        queryClient.invalidateQueries({
          queryKey: queryKeys.propertyDetail(propertyId),
        });
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(getDefaultValues());
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
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Enter the email and role. We&apos;ll send an invitation — they must accept before
              joining this property.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-member-email">Email address</Label>
                <Input
                  autoFocus
                  aria-invalid={errors.email != null}
                  id="add-member-email"
                  placeholder="name@example.com"
                  type="email"
                  {...form.register("email")}
                />
                {errors.email ? (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                ) : null}
              </div>

              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormSelectField
                    error={errors.role?.message}
                    id="add-member-role"
                    label="Role"
                    onChange={(e) => field.onChange(e.target.value as TPropertyRole)}
                    options={ROLE_OPTIONS}
                    value={field.value}
                  />
                )}
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
                {mutation.isPending ? "Sending…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
AddPropertyMemberDialog.displayName = "AddPropertyMemberDialog";
