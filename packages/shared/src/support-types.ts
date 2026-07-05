export type SupportCategory = "bug" | "feature" | "general";

export type SupportRequestStatus = "pending" | "in_progress" | "resolved";

/** Status values an admin may set (forward-only triage; not `pending`). */
export type TAdminSupportRequestSettableStatus = Extract<
  SupportRequestStatus,
  "in_progress" | "resolved"
>;

export interface IAdminSupportRequestPatchBody {
  status: TAdminSupportRequestSettableStatus;
}

export interface IAdminSupportRequestPatchResponse {
  item: IAdminSupportRequestListItem;
}

export interface ISupportRequest {
  category: SupportCategory;
  createdAt: string;
  id: string;
  message: string;
  status: SupportRequestStatus;
  updatedAt: string;
  userId: string;
}

/** Admin list row: support request plus submitter identity from `users`. */
export interface IAdminSupportRequestListItem extends ISupportRequest {
  submitterEmail: string;
  submitterName: string;
}

export interface IAdminSupportRequestsListQuery {
  category?: SupportCategory;
  cursor?: string;
  limit?: number;
  status?: SupportRequestStatus;
}

export interface IAdminSupportRequestsListResponse {
  items: IAdminSupportRequestListItem[];
  nextCursor: string | null;
}
