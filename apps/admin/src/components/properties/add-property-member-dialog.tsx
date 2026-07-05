import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { propertiesApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { PropertyRole, type TPropertyRole } from "@/packages/shared";

const ROLE_OPTIONS: { label: string; value: TPropertyRole }[] = [
  { label: "Owner", value: PropertyRole.OWNER },
  { label: "Manager", value: PropertyRole.MANAGER },
  { label: "Accountant", value: PropertyRole.ACCOUNTANT },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AddPropertyMemberDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const AddPropertyMemberDialog = memo(
  ({ onOpenChange, open, propertyId }: AddPropertyMemberDialogProps) => {
    const queryClient = useQueryClient();
    const [email, setEmail] = useState("");
    const [emailTouched, setEmailTouched] = useState(false);
    const [role, setRole] = useState<TPropertyRole>(PropertyRole.OWNER);

    const emailError =
      emailTouched && email.trim() !== "" && !EMAIL_REGEX.test(email.trim())
        ? "Please enter a valid email address"
        : null;

    const mutation = useMutation({
      mutationFn: () =>
        propertiesApi.addMember(propertyId, { email: email.trim().toLowerCase(), role }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to add member");
      },
      onSuccess: (data) => {
        if (data.type === "member_added") {
          toast.success("Member added");
        } else if (data.type === "invite_sent") {
          toast.success(`Invitation sent to ${data.invite.email}`);
        } else if (data.type === "invite_email_failed") {
          toast.warning(
            `Member invited but email failed to send: ${data.invite.emailError ?? "Unknown error"}`
          );
        }
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.propertyDetail(propertyId),
        });
        handleClose();
      },
    });

    const handleClose = () => {
      onOpenChange(false);
      setEmail("");
      setEmailTouched(false);
      setRole(PropertyRole.OWNER);
    };

    const canSubmit = EMAIL_REGEX.test(email.trim()) && !mutation.isPending;

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Enter the email address of the person you want to add. If they're not on the
              platform yet, they'll receive an invitation email.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-member-email">Email address</Label>
              <Input
                autoFocus
                aria-invalid={emailError !== null}
                id="add-member-email"
                onBlur={() => setEmailTouched(true)}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                type="email"
                value={email}
              />
              {emailError ? (
                <p className="text-xs text-destructive">{emailError}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-member-role">Role</Label>
              <select
                className={cn(
                  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "dark:bg-input/30"
                )}
                id="add-member-role"
                onChange={(e) => setRole(e.target.value as TPropertyRole)}
                value={role}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button disabled={mutation.isPending} onClick={handleClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
              type="button"
            >
              {mutation.isPending ? "Sending…" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
AddPropertyMemberDialog.displayName = "AddPropertyMemberDialog";
