import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SendHorizontal } from "lucide-react";
import { type KeyboardEvent, memo, useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { SupportAttachmentFileButton } from "@/components/support/support-attachment-file-button";
import { SupportComposerAttachmentStrip } from "@/components/support/support-composer-attachment-strip";
import {
  SUPPORT_MAX_IMAGE_ATTACHMENTS,
  supportComposerShellClass,
  supportComposerTextareaClass,
  supportDetailMetaClass,
} from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import { useSupportImageAttachments } from "@/hooks/use-support-image-attachments";
import { supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { markSupportDetailLocallyUpdated } from "@/lib/support-chat-cache";
import { toAttachmentInput } from "@/lib/upload-support-attachments";
import { cn } from "@/lib/utils";
import { validateSupportAttachmentSubmit } from "@/lib/validate-support-attachment-submit";
import { type ISupportMessageCreateBody, type SupportRequestStatus } from "@/packages/shared";

export interface SupportChatComposerProps {
  disabled?: boolean;
  idPrefix: string;
  isAdmin?: boolean;
  onListsInvalidate?: () => void;
  onMessageSent?: (messageId: string) => void;
  placeholder?: string;
  status: SupportRequestStatus;
  supportRequestId: string;
}

const MIN_TEXTAREA_HEIGHT = 44;
const MAX_TEXTAREA_HEIGHT = 160;

export const SupportChatComposer = memo(
  ({
    disabled = false,
    idPrefix,
    isAdmin = false,
    onListsInvalidate,
    onMessageSent,
    placeholder = "Write a message…",
    status,
    supportRequestId,
  }: SupportChatComposerProps) => {
    const queryClient = useQueryClient();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [replyDraft, setReplyDraft] = useState("");
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

    const resetTextareaHeight = useCallback(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }, []);

    const adjustTextareaHeight = useCallback(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.style.height = "auto";
      const nextHeight = Math.min(
        Math.max(node.scrollHeight, MIN_TEXTAREA_HEIGHT),
        MAX_TEXTAREA_HEIGHT
      );
      node.style.height = `${nextHeight}px`;
    }, []);

    const replyMutation = useMutation({
      mutationFn: (body: ISupportMessageCreateBody) => supportApi.postMessage(supportRequestId, body),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not send message");
      },
      onSuccess: (detail) => {
        setReplyDraft("");
        clearAttachments();
        resetTextareaHeight();
        queryClient.setQueryData(adminQueryKeys.supportRequest(supportRequestId), detail);

        const lastMessageId = detail.messages.at(-1)?.id;
        if (lastMessageId != null) {
          markSupportDetailLocallyUpdated(supportRequestId, lastMessageId);
          onMessageSent?.(lastMessageId);
        }

        queueMicrotask(() => {
          textareaRef.current?.focus();
        });

        if (onListsInvalidate != null) {
          queueMicrotask(onListsInvalidate);
        }
      },
    });

    const busy = disabled || replyMutation.isPending || hasPendingUploads;
    const trimmedDraft = replyDraft.trim();
    const canSend =
      (trimmedDraft.length > 0 || attachments.length > 0) &&
      allUploadsReady &&
      !hasUploadErrors &&
      !replyMutation.isPending;

    const handleSendReply = useCallback(() => {
      if (trimmedDraft.length === 0 && attachments.length === 0) {
        toast.error("Message or image is required");
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

      const body: ISupportMessageCreateBody = {
        message: trimmedDraft.length > 0 ? trimmedDraft : undefined,
        attachments:
          attachments.length > 0
            ? attachments.map((attachment) => toAttachmentInput(attachment))
            : undefined,
      };
      replyMutation.mutate(body);
    }, [
      allUploadsReady,
      attachments,
      hasPendingUploads,
      hasUploadErrors,
      replyMutation,
      trimmedDraft,
    ]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      handleSendReply();
    };

    const sendShortcutLabel =
      typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "Cmd" : "Ctrl";

    const canAddMore = attachments.length < SUPPORT_MAX_IMAGE_ATTACHMENTS;

    return (
      <div className={cn("shrink-0 pb-3 md:pb-4", supportDetailMetaClass)}>
        {status === "resolved" ? (
          <p className="text-muted-foreground mb-2 px-1 text-xs">
            You can still reply — this may reopen the ticket.
          </p>
        ) : null}
        <SupportComposerAttachmentStrip
          attachments={attachments}
          disabled={busy}
          formatFileSize={formatFileSize}
          onRemove={removeAttachment}
          onRetry={retryAttachment}
        />
        <div
          className={cn(
            supportComposerShellClass,
            isDragOver && "ring-ring/40 bg-muted/50"
          )}
          onDragLeave={dragHandlers.onDragLeave}
          onDragOver={dragHandlers.onDragOver}
          onDrop={dragHandlers.onDrop}
        >
          <div className="flex items-end gap-2">
            <SupportAttachmentFileButton
              canAddMore={canAddMore}
              disabled={busy}
              idPrefix={idPrefix}
              onAddFiles={addFiles}
            />
            <label className="sr-only" htmlFor={`${idPrefix}-composer`}>
              {isAdmin ? "Reply to user" : "Add a follow-up message"}
            </label>
            <textarea
              className={cn(supportComposerTextareaClass, "max-h-40 flex-1")}
              disabled={busy}
              id={`${idPrefix}-composer`}
              onChange={(e) => {
                setReplyDraft(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              ref={textareaRef}
              rows={1}
              value={replyDraft}
            />
            <Button
              aria-label="Send message"
              className="size-11 shrink-0 cursor-pointer rounded-full disabled:cursor-not-allowed"
              disabled={busy || !canSend}
              onClick={handleSendReply}
              size="icon"
              type="button"
            >
              <SendHorizontal className="size-4" />
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 hidden px-1 text-[11px] sm:block">
          Press {sendShortcutLabel}+Enter to send
        </p>
      </div>
    );
  }
);
SupportChatComposer.displayName = "SupportChatComposer";
