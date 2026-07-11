import { Paperclip } from "lucide-react";
import { memo, type MouseEvent, useRef } from "react";

import { SUPPORT_IMAGE_ACCEPT } from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SupportAttachmentFileButtonProps {
  canAddMore?: boolean;
  className?: string;
  disabled?: boolean;
  idPrefix: string;
  onAddFiles: (files: FileList | File[]) => void;
  variant?: "icon" | "link";
}

export const SupportAttachmentFileButton = memo(
  ({
    canAddMore = true,
    className,
    disabled = false,
    idPrefix,
    onAddFiles,
    variant = "icon",
  }: SupportAttachmentFileButtonProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputDisabled = disabled || !canAddMore;

    const handleClick = (e: MouseEvent) => {
      e.stopPropagation();
      if (inputDisabled) return;
      fileInputRef.current?.click();
    };

    return (
      <>
        {variant === "link" ? (
          <Button
            className={cn("h-auto p-0 text-sm", className)}
            disabled={inputDisabled}
            onClick={handleClick}
            type="button"
            variant="link"
          >
            browse
          </Button>
        ) : (
          <Button
            aria-label="Attach images"
            className={cn(
              "size-11 shrink-0 cursor-pointer rounded-full disabled:cursor-not-allowed",
              className
            )}
            disabled={inputDisabled}
            onClick={handleClick}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Paperclip className="size-4" />
          </Button>
        )}
        <input
          accept={SUPPORT_IMAGE_ACCEPT}
          className="sr-only"
          disabled={inputDisabled}
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
      </>
    );
  }
);
SupportAttachmentFileButton.displayName = "SupportAttachmentFileButton";
