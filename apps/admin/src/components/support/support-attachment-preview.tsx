import { XIcon } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { type SupportImageAttachment } from "@/hooks/use-support-image-attachments";
import { cn } from "@/lib/utils";

export interface SupportAttachmentPreviewProps {
  attachment: SupportImageAttachment;
  disabled?: boolean;
  formatFileSize: (bytes: number) => string;
  onRemove: (id: string) => void;
}

export const SupportAttachmentPreview = memo(
  ({ attachment, disabled = false, formatFileSize, onRemove }: SupportAttachmentPreviewProps) => {
    return (
      <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <img
          alt=""
          className="size-10 shrink-0 rounded-md object-cover"
          src={attachment.previewUrl}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{attachment.file.name}</p>
          <p className="text-muted-foreground text-xs">{formatFileSize(attachment.file.size)}</p>
        </div>
        <Button
          aria-label={`Remove ${attachment.file.name}`}
          className={cn("size-8 shrink-0", disabled && "pointer-events-none opacity-50")}
          disabled={disabled}
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
