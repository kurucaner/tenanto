import { type SupportImageAttachment } from "@/hooks/use-support-image-attachments";
import {
  type ISupportAttachmentInput,
  type ISupportAttachmentPresignFile,
  type ISupportAttachmentPresignResponse,
} from "@/packages/shared";

export async function presignAndPutSupportFile(
  file: File,
  presign: (files: ISupportAttachmentPresignFile[]) => Promise<ISupportAttachmentPresignResponse>,
  onPresigned?: (upload: { contentType: string; key: string }) => void
): Promise<{ contentType: string; key: string; sizeBytes: number }> {
  const presignResponse = await presign([
    {
      contentType: file.type,
      filename: file.name,
      sizeBytes: file.size,
    },
  ]);

  const upload = presignResponse.uploads[0];
  if (upload == null) {
    throw new Error("Could not prepare image upload");
  }

  onPresigned?.({ contentType: upload.contentType, key: upload.key });

  const response = await fetch(upload.uploadUrl, {
    body: file,
    headers: {
      "Content-Type": upload.contentType,
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(`Could not upload ${file.name}`);
  }

  return {
    contentType: upload.contentType,
    key: upload.key,
    sizeBytes: file.size,
  };
}

export function toAttachmentInput(attachment: SupportImageAttachment): ISupportAttachmentInput {
  if (attachment.storageKey == null) {
    throw new Error(`Upload not ready for ${attachment.file.name}`);
  }

  return {
    contentType: attachment.file.type,
    filename: attachment.file.name,
    key: attachment.storageKey,
    sizeBytes: attachment.file.size,
  };
}
