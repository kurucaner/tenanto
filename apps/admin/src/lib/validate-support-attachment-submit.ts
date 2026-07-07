export function validateSupportAttachmentSubmit(params: {
  allUploadsReady: boolean;
  hasPendingUploads: boolean;
  hasUploadErrors: boolean;
}): string | null {
  if (params.hasPendingUploads || !params.allUploadsReady) {
    return "Wait for image uploads to finish";
  }
  if (params.hasUploadErrors) {
    return "Fix failed uploads before submitting";
  }
  return null;
}
