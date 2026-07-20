import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SupportAttachmentPicker } from "@/components/support/support-attachment-picker";
import {
  CREATE_CATEGORY_OPTIONS,
  supportTextareaClass,
} from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Label } from "@/components/ui/label";
import { useSupportImageAttachments } from "@/hooks/use-support-image-attachments";
import { supportApi } from "@/lib/api-client";
import { toAttachmentInput } from "@/lib/upload-support-attachments";
import { validateSupportAttachmentSubmit } from "@/lib/validate-support-attachment-submit";
import { type SupportCategory } from "@/packages/shared";

export const CreateSupportRequestDialog = memo(
  ({
    onOpenChange,
    open,
  }: Readonly<{
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }>) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [category, setCategory] = useState<SupportCategory>("bug");
    const [message, setMessage] = useState("");
    const {
      addFiles,
      allUploadsReady,
      attachments,
      clearAttachments,
      dragHandlers,
      formatFileSize,
      hasPendingUploads,
      hasUploadErrors,
      isDragOver,
      removeAttachment,
      retryAttachment,
    } = useSupportImageAttachments();

    const resetForm = useCallback(() => {
      setCategory("bug");
      setMessage("");
      clearAttachments();
    }, [clearAttachments]);

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          resetForm();
        }
        onOpenChange(nextOpen);
      },
      [onOpenChange, resetForm]
    );

    const mutation = useMutation({
      mutationFn: async () => {
        const attachmentInputs =
          attachments.length > 0
            ? attachments.map((attachment) => toAttachmentInput(attachment))
            : undefined;

        return supportApi.create({
          attachments: attachmentInputs,
          category,
          message: message.trim(),
        });
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not submit request");
      },
      onSuccess: (data) => {
        toast.success("Support request submitted");
        queryClient.invalidateQueries({ queryKey: ["support", "list"] });
        handleOpenChange(false);
        navigate(`/support-requests/${encodeURIComponent(data.id)}`);
      },
    });

    const handleSubmit = (e: { preventDefault(): void }) => {
      e.preventDefault();
      if (message.trim().length === 0) {
        toast.error("Message is required");
        return;
      }
      const attachmentError = validateSupportAttachmentSubmit({
        allUploadsReady,
        hasPendingUploads,
        hasUploadErrors,
      });
      if (attachmentError != null) {
        toast.error(attachmentError);
        return;
      }
      mutation.mutate();
    };

    const isBusy = mutation.isPending || hasPendingUploads;
    const canSubmit = allUploadsReady && !hasUploadErrors && !mutation.isPending;

    const submitLabel = (() => {
      if (hasPendingUploads) return "Waiting for uploads…";
      if (mutation.isPending) return "Submitting…";
      return "Submit request";
    })();

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>New support request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <DialogFormFields>
              <FormSelectField
                disabled={isBusy}
                id="create-support-category"
                label="Category"
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
                options={CREATE_CATEGORY_OPTIONS}
                value={category}
              />
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-support-message">Message</Label>
                <textarea
                  className={supportTextareaClass}
                  disabled={isBusy}
                  id="create-support-message"
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the issue or request…"
                  required
                  value={message}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="create-support-attachments-dropzone" optional>
                  Attachments
                </FieldLabel>
                <SupportAttachmentPicker
                  attachments={attachments}
                  disabled={isBusy}
                  dragHandlers={dragHandlers}
                  formatFileSize={formatFileSize}
                  idPrefix="create-support"
                  isDragOver={isDragOver}
                  onAddFiles={addFiles}
                  onRemove={removeAttachment}
                  onRetry={retryAttachment}
                />
              </div>
            </DialogFormFields>
            <DialogFooter>
              <Button disabled={!canSubmit || isBusy} type="submit">
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateSupportRequestDialog.displayName = "CreateSupportRequestDialog";
