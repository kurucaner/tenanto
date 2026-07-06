export type SupportCategory = "bug" | "feature" | "general";

export type SupportRequestStatus = "pending" | "in_progress" | "resolved";

/** Status values an admin may set (forward-only triage; not `pending`). */
export type TAdminSupportRequestSettableStatus = Extract<
  SupportRequestStatus,
  "in_progress" | "resolved"
>;

export interface ISupportMessage {
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

export interface ISupportCreateBody {
  category: SupportCategory;
  message: string;
}

export interface ISupportMessageCreateBody {
  message: string;
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
