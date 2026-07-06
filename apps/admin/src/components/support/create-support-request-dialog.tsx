import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SupportAttachmentPicker } from "@/components/support/support-attachment-picker";
import {
  CREATE_CATEGORY_OPTIONS,
  supportSelectClass,
  supportTextareaClass,
} from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSupportImageAttachments } from "@/hooks/use-support-image-attachments";
import { supportApi } from "@/lib/api-client";
import { uploadSupportAttachments } from "@/lib/upload-support-attachments";
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
    const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
    const {
      addFiles,
      attachments,
      clearAttachments,
      dragHandlers,
      formatFileSize,
      isDragOver,
      removeAttachment,
    } = useSupportImageAttachments();

    const resetForm = useCallback(() => {
      setCategory("bug");
      setMessage("");
      setIsUploadingAttachments(false);
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
        let attachmentInputs;
        if (attachments.length > 0) {
          setIsUploadingAttachments(true);
          try {
            attachmentInputs = await uploadSupportAttachments(
              attachments.map((attachment) => attachment.file),
              (files) => supportApi.presignAttachments({ files })
            );
          } finally {
            setIsUploadingAttachments(false);
          }
        }

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
      mutation.mutate();
    };

    const isBusy = mutation.isPending || isUploadingAttachments;

    const submitLabel = (() => {
      if (isUploadingAttachments) return "Uploading images…";
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
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-support-category">Category</Label>
                <select
                  className={supportSelectClass}
                  disabled={isBusy}
                  id="create-support-category"
                  onChange={(e) => setCategory(e.target.value as SupportCategory)}
                  value={category}
                >
                  {CREATE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
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
                <Label htmlFor="create-support-attachments-dropzone">Attachments (optional)</Label>
                <SupportAttachmentPicker
                  attachments={attachments}
                  disabled={isBusy}
                  dragHandlers={dragHandlers}
                  formatFileSize={formatFileSize}
                  idPrefix="create-support"
                  isDragOver={isDragOver}
                  onAddFiles={addFiles}
                  onRemove={removeAttachment}
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={isBusy} type="submit">
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
