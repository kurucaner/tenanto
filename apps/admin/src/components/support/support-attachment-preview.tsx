import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import {
  type SupportImageAttachment,
  type SupportUploadStatus,
} from "@/hooks/use-support-image-attachments";
import { cn } from "@/lib/utils";

export interface SupportAttachmentPreviewProps {
  attachment: SupportImageAttachment;
  disabled?: boolean;
  formatFileSize: (bytes: number) => string;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

function getStatusLabel(uploadStatus: SupportUploadStatus): string | null {
  if (uploadStatus === "pending" || uploadStatus === "idle") {
    return "Uploading…";
  }
  if (uploadStatus === "confirmed" || uploadStatus === "linked") {
    return "Ready";
  }
  if (uploadStatus === "error") {
    return "Upload failed";
  }
  return null;
}

export const SupportAttachmentPreview = memo(
  ({
    attachment,
    disabled = false,
    formatFileSize,
    onRemove,
    onRetry,
  }: SupportAttachmentPreviewProps) => {
    const statusLabel = getStatusLabel(attachment.uploadStatus);
    const isPending = attachment.uploadStatus === "pending" || attachment.uploadStatus === "idle";
    const isConfirmed =
      attachment.uploadStatus === "confirmed" || attachment.uploadStatus === "linked";
    const isError = attachment.uploadStatus === "error";
    const removeDisabled = disabled || isPending;

    return (
      <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <img
          alt=""
          className="size-10 shrink-0 rounded-md object-cover"
          src={attachment.previewUrl}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{attachment.file.name}</p>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span>{formatFileSize(attachment.file.size)}</span>
            {statusLabel != null ? (
              <>
                <span aria-hidden>·</span>
                {isPending ? (
                  <Loader2Icon aria-hidden className="size-3 animate-spin" />
                ) : null}
                {isConfirmed ? <CheckIcon aria-hidden className="size-3 text-emerald-600" /> : null}
                <span className={cn(isError && "text-destructive")}>{statusLabel}</span>
              </>
            ) : null}
          </div>
        </div>
        {isError ? (
          <Button
            className="h-8 shrink-0 px-2 text-xs"
            disabled={disabled}
            onClick={() => onRetry(attachment.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        ) : null}
        <Button
          aria-label={`Remove ${attachment.file.name}`}
          className={cn("size-8 shrink-0", removeDisabled && "pointer-events-none opacity-50")}
          disabled={removeDisabled}
          onClick={() => onRemove(attachment.id)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </li>
    );
  }
);
SupportAttachmentPreview.displayName = "SupportAttachmentPreview";
