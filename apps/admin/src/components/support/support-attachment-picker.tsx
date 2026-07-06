import { ImagePlus } from "lucide-react";
import { type DragEvent,memo, useRef } from "react";

import { SupportAttachmentPreview } from "@/components/support/support-attachment-preview";
import {
  SUPPORT_IMAGE_ACCEPT,
  SUPPORT_MAX_IMAGE_ATTACHMENTS,
  supportAttachmentDropzoneClass,
} from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
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
  }: SupportAttachmentPickerProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropzoneId = `${idPrefix}-attachments-dropzone`;
    const canAddMore = attachments.length < SUPPORT_MAX_IMAGE_ATTACHMENTS;

    const handleBrowseClick = () => {
      if (disabled || !canAddMore) return;
      fileInputRef.current?.click();
    };

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
            <Button
              className="h-auto p-0 text-sm"
              disabled={disabled || !canAddMore}
              onClick={handleBrowseClick}
              type="button"
              variant="link"
            >
              browse
            </Button>
          </p>
          <input
            accept={SUPPORT_IMAGE_ACCEPT}
            className="sr-only"
            disabled={disabled || !canAddMore}
            id={`${idPrefix}-attachments-input`}
            multiple
            onChange={(event) => {
              if (event.target.files != null && event.target.files.length > 0) {
                onAddFiles(event.target.files);
              }
              event.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
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
              />
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
);
SupportAttachmentPicker.displayName = "SupportAttachmentPicker";
