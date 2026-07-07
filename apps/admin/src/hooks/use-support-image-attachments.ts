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

type AddFileRejection = "duplicate" | "invalid_type" | "max_count" | "oversized";

type ProcessIncomingFileResult =
  | { accepted: false; rejection: AddFileRejection }
  | { accepted: true; attachment: SupportImageAttachment };

type AddFilesRejectionFlags = Record<AddFileRejection, boolean>;

function createEmptyRejectionFlags(): AddFilesRejectionFlags {
  return {
    duplicate: false,
    invalid_type: false,
    max_count: false,
    oversized: false,
  };
}

function processIncomingFile(
  file: File,
  nextAttachments: SupportImageAttachment[]
): ProcessIncomingFileResult {
  if (!SUPPORT_ALLOWED_IMAGE_MIME_TYPE_SET.has(file.type)) {
    return { accepted: false, rejection: "invalid_type" };
  }

  if (file.size > SUPPORT_MAX_IMAGE_BYTES) {
    return { accepted: false, rejection: "oversized" };
  }

  if (isDuplicateAttachment(nextAttachments, file)) {
    return { accepted: false, rejection: "duplicate" };
  }

  if (nextAttachments.length >= SUPPORT_MAX_IMAGE_ATTACHMENTS) {
    return { accepted: false, rejection: "max_count" };
  }

  const id = createAttachmentId();
  return {
    accepted: true,
    attachment: {
      file,
      id,
      previewUrl: URL.createObjectURL(file),
      uploadStatus: "idle",
    },
  };
}

function showOversizedFileToast(fileName: string): void {
  toast.error(`${fileName} exceeds the 5 MB limit`);
}

function showAddFilesRejectionToasts(rejections: AddFilesRejectionFlags): void {
  if (rejections.invalid_type) {
    toast.error("Only image files are supported");
  }

  if (rejections.max_count) {
    toast.error(`You can attach up to ${SUPPORT_MAX_IMAGE_ATTACHMENTS} images`);
  }

  if (
    rejections.duplicate &&
    !rejections.max_count &&
    !rejections.invalid_type &&
    !rejections.oversized
  ) {
    toast.error("Some images were already added");
  }
}

function collectIncomingAttachments(
  incoming: File[],
  current: SupportImageAttachment[]
): {
  nextAttachments: SupportImageAttachment[];
  rejections: AddFilesRejectionFlags;
  uploadsToStart: { file: File; id: string }[];
} {
  const nextAttachments = [...current];
  const uploadsToStart: { file: File; id: string }[] = [];
  const rejections = createEmptyRejectionFlags();

  for (const file of incoming) {
    const result = processIncomingFile(file, nextAttachments);
    if (!result.accepted) {
      rejections[result.rejection] = true;
      if (result.rejection === "oversized") {
        showOversizedFileToast(file.name);
      }
      if (result.rejection === "max_count") {
        break;
      }
      continue;
    }

    nextAttachments.push(result.attachment);
    uploadsToStart.push({ file: result.attachment.file, id: result.attachment.id });
  }

  return { nextAttachments, rejections, uploadsToStart };
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

  const uploadAttachment = useCallback(
    async (attachmentId: string, file: File) => {
      updateAttachment(attachmentId, { uploadStatus: "pending" });

      try {
        await presignAndPutSupportFile(
          file,
          (files) => supportApi.presignAttachments({ files }),
          ({ key }) => {
            updateAttachment(attachmentId, {
              storageKey: key,
              uploadStatus: "pending",
            });

            clearUnsubscribe(attachmentId);
            const unsubscribe = subscribeSupportAttachmentStatus(key, (status) => {
              if (status === "confirmed" || status === "linked") {
                updateAttachment(attachmentId, { uploadStatus: "confirmed" });
              }
            });
            unsubscribeByAttachmentIdRef.current.set(attachmentId, unsubscribe);
          }
        );
      } catch (error) {
        updateAttachment(attachmentId, { uploadStatus: "error" });
        toast.error(error instanceof Error ? error.message : "Could not upload image");
      }
    },
    [clearUnsubscribe, updateAttachment]
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
      const { nextAttachments, rejections, uploadsToStart } = collectIncomingAttachments(
        incoming,
        current
      );

      showAddFilesRejectionToasts(rejections);

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
