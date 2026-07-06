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
import { supportApi } from "@/lib/api-client";
import { subscribeSupportAttachmentStatus } from "@/lib/support-attachment-status-registry";
import { presignAndPutSupportFile } from "@/lib/upload-support-attachments";

export type SupportUploadStatus = "confirmed" | "error" | "idle" | "linked" | "pending";

export interface SupportImageAttachment {
  file: File;
  id: string;
  previewUrl: string;
  storageKey?: string;
  uploadStatus: SupportUploadStatus;
}

const POLL_INTERVAL_MS = 500;
const POLL_MAX_ATTEMPTS = 10;

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useSupportImageAttachments() {
  const [attachments, setAttachments] = useState<SupportImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const attachmentsRef = useRef(attachments);
  const unsubscribeByAttachmentIdRef = useRef(new Map<string, () => void>());

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const revokePreviewUrl = useCallback((previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
  }, []);

  const clearUnsubscribe = useCallback((attachmentId: string) => {
    const unsubscribe = unsubscribeByAttachmentIdRef.current.get(attachmentId);
    if (unsubscribe != null) {
      unsubscribe();
      unsubscribeByAttachmentIdRef.current.delete(attachmentId);
    }
  }, []);

  const updateAttachment = useCallback(
    (attachmentId: string, patch: Partial<SupportImageAttachment>) => {
      setAttachments((current) =>
        current.map((attachment) =>
          attachment.id === attachmentId ? { ...attachment, ...patch } : attachment
        )
      );
    },
    []
  );

  const pollUntilConfirmed = useCallback(
    async (attachmentId: string, storageKey: string) => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
        await delay(POLL_INTERVAL_MS);

        const current = attachmentsRef.current.find((attachment) => attachment.id === attachmentId);
        if (current?.uploadStatus === "confirmed" || current?.uploadStatus === "linked") {
          return;
        }

        const response = await supportApi.attachmentStatus({ keys: [storageKey] });
        const status = response.keys[storageKey];
        if (status === "confirmed" || status === "linked") {
          updateAttachment(attachmentId, { uploadStatus: "confirmed" });
          return;
        }
      }
    },
    [updateAttachment]
  );

  const uploadAttachment = useCallback(
    async (attachmentId: string, file: File) => {
      updateAttachment(attachmentId, { uploadStatus: "pending" });

      try {
        const uploaded = await presignAndPutSupportFile(file, (files) =>
          supportApi.presignAttachments({ files })
        );

        updateAttachment(attachmentId, {
          storageKey: uploaded.key,
          uploadStatus: "pending",
        });

        clearUnsubscribe(attachmentId);
        const unsubscribe = subscribeSupportAttachmentStatus(uploaded.key, (status) => {
          if (status === "confirmed" || status === "linked") {
            updateAttachment(attachmentId, { uploadStatus: "confirmed" });
          }
        });
        unsubscribeByAttachmentIdRef.current.set(attachmentId, unsubscribe);

        void pollUntilConfirmed(attachmentId, uploaded.key);
      } catch (error) {
        updateAttachment(attachmentId, { uploadStatus: "error" });
        toast.error(error instanceof Error ? error.message : "Could not upload image");
      }
    },
    [clearUnsubscribe, pollUntilConfirmed, updateAttachment]
  );

  const clearAttachments = useCallback(() => {
    for (const attachmentId of unsubscribeByAttachmentIdRef.current.keys()) {
      clearUnsubscribe(attachmentId);
    }
    setAttachments((current) => {
      for (const attachment of current) {
        revokePreviewUrl(attachment.previewUrl);
      }
      return [];
    });
  }, [clearUnsubscribe, revokePreviewUrl]);

  const removeAttachment = useCallback(
    (id: string) => {
      clearUnsubscribe(id);
      setAttachments((current) => {
        const target = current.find((attachment) => attachment.id === id);
        if (target != null) {
          revokePreviewUrl(target.previewUrl);
        }
        return current.filter((attachment) => attachment.id !== id);
      });
    },
    [clearUnsubscribe, revokePreviewUrl]
  );

  const retryAttachment = useCallback(
    (id: string) => {
      const attachment = attachmentsRef.current.find((item) => item.id === id);
      if (attachment == null) return;
      void uploadAttachment(id, attachment.file);
    },
    [uploadAttachment]
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const current = attachmentsRef.current;
      const nextAttachments = [...current];
      const uploadsToStart: { file: File; id: string }[] = [];
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

        const id = createAttachmentId();
        nextAttachments.push({
          file,
          id,
          previewUrl: URL.createObjectURL(file),
          uploadStatus: "idle",
        });
        uploadsToStart.push({ file, id });
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
        for (const upload of uploadsToStart) {
          void uploadAttachment(upload.id, upload.file);
        }
      }
    },
    [uploadAttachment]
  );

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
        revokePreviewUrl(attachment.previewUrl);
      }
      for (const unsubscribe of unsubscribeByAttachmentIdRef.current.values()) {
        unsubscribe();
      }
      unsubscribeByAttachmentIdRef.current.clear();
    };
  }, [revokePreviewUrl]);

  const allUploadsReady = attachments.every(
    (attachment) => attachment.uploadStatus === "confirmed" || attachment.uploadStatus === "linked"
  );

  const hasPendingUploads = attachments.some(
    (attachment) => attachment.uploadStatus === "pending" || attachment.uploadStatus === "idle"
  );

  const hasUploadErrors = attachments.some((attachment) => attachment.uploadStatus === "error");

  return {
    addFiles,
    allUploadsReady,
    attachments,
    clearAttachments,
    dragHandlers: { onDragLeave, onDragOver, onDrop },
    formatFileSize,
    hasPendingUploads,
    hasUploadErrors,
    isDragOver,
    removeAttachment,
    retryAttachment,
  };
}
