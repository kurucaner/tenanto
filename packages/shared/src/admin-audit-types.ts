/** Stable action names for admin audit log filtering and documentation */
export const AdminAuditAction = {
  APP_CONFIG_UPDATED: "app_config.updated",
  PROPERTY_CREATED: "property.created",
  PROPERTY_DELETED: "property.deleted",
  PROPERTY_UPDATED: "property.updated",
  USER_ACCOUNT_RESET: "user.account_reset",
} as const;

export type TAdminAuditAction = (typeof AdminAuditAction)[keyof typeof AdminAuditAction];

export interface IAdminAuditEvent {
  action: string;
  actorEmail: string;
  actorUserId: string | null;
  createdAt: string;
  id: string;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  resourceId: string | null;
  resourceType: string;
  userAgent: string | null;
}

export interface IAdminAuditEventsListResponse {
  events: IAdminAuditEvent[];
  nextCursor: string | null;
}

export interface IAdminAuditEventsListQuery {
  actor_user_id?: string;
  cursor?: string;
  limit?: number;
  resource_id?: string;
  resource_type?: string;
}
