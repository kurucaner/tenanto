import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

import { supportTextareaClass } from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { type ISupportRequestDetail } from "@/packages/shared";

export const SupportReplyForm = memo(
  ({
    disabled = false,
    idPrefix,
    onSuccess,
    placeholder = "Write a reply…",
    supportRequestId,
  }: Readonly<{
    disabled?: boolean;
    idPrefix: string;
    onSuccess?: (detail: ISupportRequestDetail) => void;
    placeholder?: string;
    supportRequestId: string;
  }>) => {
    const queryClient = useQueryClient();
    const [replyDraft, setReplyDraft] = useState("");

    const replyMutation = useMutation({
      mutationFn: (message: string) => supportApi.postMessage(supportRequestId, { message }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not send reply");
      },
      onSuccess: (detail) => {
        toast.success("Reply sent");
        setReplyDraft("");
        queryClient.setQueryData(adminQueryKeys.supportRequest(supportRequestId), detail);
        onSuccess?.(detail);
      },
    });

    const busy = disabled || replyMutation.isPending;

    const handleSendReply = () => {
      const trimmed = replyDraft.trim();
      if (trimmed.length === 0) {
        toast.error("Reply cannot be empty");
        return;
      }
      replyMutation.mutate(trimmed);
    };

    return (
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-reply`}>Reply</Label>
        <textarea
          className={supportTextareaClass}
          disabled={busy}
          id={`${idPrefix}-reply`}
          onChange={(e) => setReplyDraft(e.target.value)}
          placeholder={placeholder}
          value={replyDraft}
        />
        <Button
          className="cursor-pointer disabled:cursor-not-allowed"
          disabled={busy || replyDraft.trim().length === 0}
          onClick={handleSendReply}
          type="button"
        >
          {replyMutation.isPending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    );
  }
);
SupportReplyForm.displayName = "SupportReplyForm";
