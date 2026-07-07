import { memo } from "react";

import { SupportAttachmentPreview } from "@/components/support/support-attachment-preview";
import { type SupportImageAttachment } from "@/hooks/use-support-image-attachments";

export interface SupportComposerAttachmentStripProps {
  attachments: SupportImageAttachment[];
  disabled?: boolean;
  formatFileSize: (bytes: number) => string;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export const SupportComposerAttachmentStrip = memo(
  ({
    attachments,
    disabled = false,
    formatFileSize,
    onRemove,
    onRetry,
  }: SupportComposerAttachmentStripProps) => {
    if (attachments.length === 0) return null;

    return (
      <ul className="mb-2 flex gap-3 overflow-x-auto px-1 pb-1">
        {attachments.map((attachment) => (
          <SupportAttachmentPreview
            attachment={attachment}
            disabled={disabled}
            formatFileSize={formatFileSize}
            key={attachment.id}
            onRemove={onRemove}
            onRetry={onRetry}
            variant="compact"
          />
        ))}
      </ul>
    );
  }
);
SupportComposerAttachmentStrip.displayName = "SupportComposerAttachmentStrip";
