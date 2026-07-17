import { toast } from "sonner";

export function handlePropertyMemberInviteMutationSuccess(
  message: string,
  options?: { emailError?: string; emailSent?: boolean }
): void {
  if (options?.emailSent === false && options.emailError) {
    toast.error(options.emailError);
    return;
  }
  toast.success(message);
}
