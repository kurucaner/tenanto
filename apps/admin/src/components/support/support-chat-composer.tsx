import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SendHorizontal } from "lucide-react";
import { memo, useCallback, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { supportTextareaClass } from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import { supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { markSupportDetailLocallyUpdated } from "@/lib/support-chat-cache";
import { cn } from "@/lib/utils";
import { type SupportRequestStatus } from "@/packages/shared";

export interface SupportChatComposerProps {
  disabled?: boolean;
  idPrefix: string;
  isAdmin?: boolean;
  onListsInvalidate?: () => void;
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
    placeholder = "Write a message…",
    status,
    supportRequestId,
  }: SupportChatComposerProps) => {
    const queryClient = useQueryClient();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [replyDraft, setReplyDraft] = useState("");

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
      mutationFn: (message: string) => supportApi.postMessage(supportRequestId, { message }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not send message");
      },
      onSuccess: (detail) => {
        toast.success("Message sent");
        setReplyDraft("");
        resetTextareaHeight();
        queryClient.setQueryData(adminQueryKeys.supportRequest(supportRequestId), detail);

        const lastMessageId = detail.messages.at(-1)?.id;
        if (lastMessageId != null) {
          markSupportDetailLocallyUpdated(supportRequestId, lastMessageId);
        }

        if (onListsInvalidate != null) {
          queueMicrotask(onListsInvalidate);
        }
      },
    });

    const busy = disabled || replyMutation.isPending;

    const handleSendReply = useCallback(() => {
      const trimmed = replyDraft.trim();
      if (trimmed.length === 0) {
        toast.error("Message cannot be empty");
        return;
      }
      replyMutation.mutate(trimmed);
    }, [replyDraft, replyMutation]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      handleSendReply();
    };

    const sendShortcutLabel =
      typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "Cmd" : "Ctrl";

    return (
      <div className="shrink-0 border-t border-border/60 bg-card/80 p-3 backdrop-blur-sm md:p-4">
        {status === "resolved" ? (
          <p className="text-muted-foreground mb-2 text-xs">
            You can still reply — this may reopen the ticket.
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor={`${idPrefix}-composer`}>
            {isAdmin ? "Reply to user" : "Add a follow-up message"}
          </label>
          <textarea
            className={cn(
              supportTextareaClass,
              "max-h-40 min-h-11 flex-1 resize-none py-2.5 leading-relaxed"
            )}
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
            className="size-11 shrink-0 rounded-full"
            disabled={busy || replyDraft.trim().length === 0}
            onClick={handleSendReply}
            size="icon"
            type="button"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 hidden text-[11px] sm:block">
          Press {sendShortcutLabel}+Enter to send
        </p>
      </div>
    );
  }
);
SupportChatComposer.displayName = "SupportChatComposer";
