import { ImagePlus } from "lucide-react";
import { type DragEvent, memo } from "react";

import { SupportAttachmentFileButton } from "@/components/support/support-attachment-file-button";
import { SupportAttachmentPreview } from "@/components/support/support-attachment-preview";
import {
  SUPPORT_MAX_IMAGE_ATTACHMENTS,
  supportAttachmentDropzoneClass,
} from "@/components/support/support-constants";
import { type SupportImageAttachment } from "@/hooks/use-support-image-attachments";
import { cn } from "@/lib/utils";

export interface SupportAttachmentPickerProps {
  attachments: SupportImageAttachment[];
  disabled?: boolean;
  dragHandlers: {
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  formatFileSize: (bytes: number) => string;
  idPrefix: string;
  isDragOver: boolean;
  onAddFiles: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export const SupportAttachmentPicker = memo(
  ({
    attachments,
    disabled = false,
    dragHandlers,
    formatFileSize,
    idPrefix,
    isDragOver,
    onAddFiles,
    onRemove,
    onRetry,
  }: SupportAttachmentPickerProps) => {
    const dropzoneId = `${idPrefix}-attachments-dropzone`;
    const canAddMore = attachments.length < SUPPORT_MAX_IMAGE_ATTACHMENTS;

    return (
      <div className="flex flex-col gap-2">
        <div
          aria-label="Image attachment drop zone"
          className={cn(
            supportAttachmentDropzoneClass,
            isDragOver && "border-ring bg-muted/30",
            disabled && "pointer-events-none opacity-50"
          )}
          id={dropzoneId}
          onDragLeave={dragHandlers.onDragLeave}
          onDragOver={dragHandlers.onDragOver}
          onDrop={dragHandlers.onDrop}
          role="region"
        >
          <ImagePlus className="text-muted-foreground size-5" />
          <p className="text-muted-foreground text-center text-sm">
            Drag images here or{" "}
            <SupportAttachmentFileButton
              canAddMore={canAddMore}
              disabled={disabled}
              idPrefix={idPrefix}
              onAddFiles={onAddFiles}
              variant="link"
            />
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          PNG, JPG, GIF, or WebP · up to {SUPPORT_MAX_IMAGE_ATTACHMENTS} images · 5 MB each
        </p>
        {attachments.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {attachments.map((attachment) => (
              <SupportAttachmentPreview
                attachment={attachment}
                disabled={disabled}
                formatFileSize={formatFileSize}
                key={attachment.id}
                onRemove={onRemove}
                onRetry={onRetry}
              />
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
);
SupportAttachmentPicker.displayName = "SupportAttachmentPicker";
