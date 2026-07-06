import {
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  SUPPORT_ALLOWED_IMAGE_MIME_TYPE_SET,
  SUPPORT_MAX_IMAGE_ATTACHMENTS,
  SUPPORT_MAX_IMAGE_BYTES,
} from "@/components/support/support-constants";

export interface SupportImageAttachment {
  file: File;
  id: string;
  previewUrl: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createAttachmentId(): string {
  return crypto.randomUUID();
}

function isDuplicateAttachment(
  attachments: SupportImageAttachment[],
  file: File
): boolean {
  return attachments.some(
    (attachment) => attachment.file.name === file.name && attachment.file.size === file.size
  );
}

export function useSupportImageAttachments() {
  const [attachments, setAttachments] = useState<SupportImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const revokePreviewUrl = useCallback((previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((current) => {
      for (const attachment of current) {
        revokePreviewUrl(attachment.previewUrl);
      }
      return [];
    });
  }, [revokePreviewUrl]);

  const removeAttachment = useCallback(
    (id: string) => {
      setAttachments((current) => {
        const target = current.find((attachment) => attachment.id === id);
        if (target != null) {
          revokePreviewUrl(target.previewUrl);
        }
        return current.filter((attachment) => attachment.id !== id);
      });
    },
    [revokePreviewUrl]
  );

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const current = attachmentsRef.current;
    const nextAttachments = [...current];
    let rejectedType = false;
    let rejectedSize = false;
    let rejectedDuplicate = false;
    let rejectedCount = false;

    for (const file of incoming) {
      if (!SUPPORT_ALLOWED_IMAGE_MIME_TYPE_SET.has(file.type)) {
        rejectedType = true;
        continue;
      }

      if (file.size > SUPPORT_MAX_IMAGE_BYTES) {
        rejectedSize = true;
        toast.error(`${file.name} exceeds the 5 MB limit`);
        continue;
      }

      if (isDuplicateAttachment(nextAttachments, file)) {
        rejectedDuplicate = true;
        continue;
      }

      if (nextAttachments.length >= SUPPORT_MAX_IMAGE_ATTACHMENTS) {
        rejectedCount = true;
        break;
      }

      nextAttachments.push({
        file,
        id: createAttachmentId(),
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (rejectedType) {
      toast.error("Only image files are supported");
    }

    if (rejectedCount) {
      toast.error(`You can attach up to ${SUPPORT_MAX_IMAGE_ATTACHMENTS} images`);
    }

    if (rejectedDuplicate && !rejectedCount && !rejectedType && !rejectedSize) {
      toast.error("Some images were already added");
    }

    if (nextAttachments.length !== current.length) {
      setAttachments(nextAttachments);
    }
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      if (event.dataTransfer.files.length > 0) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles]
  );

  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    };
  }, []);

  return {
    addFiles,
    attachments,
    clearAttachments,
    dragHandlers: { onDragLeave, onDragOver, onDrop },
    formatFileSize,
    isDragOver,
    removeAttachment,
  };
}
