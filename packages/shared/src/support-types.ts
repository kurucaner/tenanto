export type SupportCategory = "bug" | "feature" | "general";

export type SupportRequestStatus = "pending" | "in_progress" | "resolved";

/** Status values an admin may set (forward-only triage; not `pending`). */
export type TAdminSupportRequestSettableStatus = Extract<
  SupportRequestStatus,
  "in_progress" | "resolved"
>;

export const SUPPORT_MAX_IMAGE_ATTACHMENTS = 5;

export const SUPPORT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const SUPPORT_ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export type TSupportAllowedImageMimeType = (typeof SUPPORT_ALLOWED_IMAGE_MIME_TYPES)[number];

export type TSupportStagedUploadStatus = "confirmed" | "linked" | "pending";

export interface ISupportAttachment {
  contentType: string;
  downloadUrl: string;
  filename: string;
  id: string;
  sizeBytes: number;
}

export interface ISupportMessage {
  attachments: ISupportAttachment[];
  authorEmail: string;
  authorName: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  id: string;
}

export interface ISupportRequest {
  category: SupportCategory;
  createdAt: string;
  id: string;
  status: SupportRequestStatus;
  updatedAt: string;
  userId: string;
}

export interface ISupportRequestListItem extends ISupportRequest {
  lastMessagePreview: string;
  messageCount: number;
}

/** Admin list row: support request plus submitter identity from `users`. */
export interface IAdminSupportRequestListItem extends ISupportRequestListItem {
  submitterEmail: string;
  submitterName: string;
}

export interface ISupportRequestDetail {
  item: ISupportRequest;
  messages: ISupportMessage[];
}

export interface ISupportAttachmentInput {
  contentType: string;
  filename: string;
  key: string;
  sizeBytes: number;
}

export interface ISupportCreateBody {
  attachments?: ISupportAttachmentInput[];
  category: SupportCategory;
  message: string;
}

export interface ISupportMessageCreateBody {
  attachments?: ISupportAttachmentInput[];
  message?: string;
}

export interface ISupportAttachmentPresignFile {
  contentType: string;
  filename: string;
  sizeBytes: number;
}

export interface ISupportAttachmentPresignBody {
  files: ISupportAttachmentPresignFile[];
}

export interface ISupportAttachmentPresignItem {
  contentType: string;
  key: string;
  uploadUrl: string;
}

export interface ISupportAttachmentPresignResponse {
  uploads: ISupportAttachmentPresignItem[];
}

export interface IAdminSupportRequestPatchBody {
  status: TAdminSupportRequestSettableStatus;
}

export interface IAdminSupportRequestPatchResponse {
  item: IAdminSupportRequestListItem;
}

export interface ISupportRequestsListQuery {
  category?: SupportCategory;
  cursor?: string;
  limit?: number;
  status?: SupportRequestStatus;
}

export interface ISupportRequestsListResponse {
  items: ISupportRequestListItem[];
  nextCursor: string | null;
}

/** @deprecated Use ISupportRequestsListQuery */
export type IAdminSupportRequestsListQuery = ISupportRequestsListQuery;

/** @deprecated Use ISupportRequestsListResponse with IAdminSupportRequestListItem items */
export interface IAdminSupportRequestsListResponse {
  items: IAdminSupportRequestListItem[];
  nextCursor: string | null;
}
