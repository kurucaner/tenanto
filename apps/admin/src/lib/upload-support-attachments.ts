import {
  type ISupportAttachmentInput,
  type ISupportAttachmentPresignFile,
  type ISupportAttachmentPresignResponse,
} from "@/packages/shared";

export async function uploadSupportAttachments(
  files: File[],
  presign: (files: ISupportAttachmentPresignFile[]) => Promise<ISupportAttachmentPresignResponse>
): Promise<ISupportAttachmentInput[]> {
  if (files.length === 0) return [];

  const presignResponse = await presign(
    files.map((file) => ({
      contentType: file.type,
      filename: file.name,
      sizeBytes: file.size,
    }))
  );

  if (presignResponse.uploads.length !== files.length) {
    throw new Error("Could not prepare image uploads");
  }

  await Promise.all(
    presignResponse.uploads.map(async (upload, index) => {
      const file = files[index];
      if (file == null) {
        throw new Error("Could not prepare image uploads");
      }

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
    })
  );

  return presignResponse.uploads.map((upload, index) => {
    const file = files[index];
    if (file == null) {
      throw new Error("Could not prepare image uploads");
    }

    return {
      contentType: upload.contentType,
      filename: file.name,
      key: upload.key,
      sizeBytes: file.size,
    };
  });
}
