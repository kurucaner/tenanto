import type {
  IAdminPropertiesListQuery,
  IAdminUsersListQuery,
} from "@/lib/api-client";
import type {
  IAdminAuditEventsListQuery,
  IAdminSupportRequestsListQuery,
  IPropertyReservationsListQuery,
} from "@/packages/shared";

export const adminQueryKeys = {
  appConfig: () => ["admin", "app-config"] as const,
  platformStats: () => ["admin", "platform-stats"] as const,
  auditLog: (filters: Omit<IAdminAuditEventsListQuery, "cursor" | "limit">) =>
    ["admin", "activity", filters] as const,
  user: (userId: string) => ["admin", "user", userId] as const,
  userAudit: (userId: string) => ["admin", "user", userId, "audit"] as const,
  usersList: (filters: Omit<IAdminUsersListQuery, "cursor">) =>
    ["admin", "users", filters] as const,
  notificationBroadcastHistory: () => ["admin", "notification-broadcasts", "history"] as const,
  supportRequestsList: (filters: Omit<IAdminSupportRequestsListQuery, "cursor" | "limit">) =>
    ["admin", "support-requests", filters] as const,
  propertiesList: (filters: Omit<IAdminPropertiesListQuery, "cursor">) =>
    ["admin", "properties", filters] as const,
  propertyDetail: (propertyId: string) => ["admin", "property", propertyId] as const,
  propertyUnits: (propertyId: string) => ["admin", "property", propertyId, "units"] as const,
  propertySettings: (propertyId: string) => ["admin", "property", propertyId, "settings"] as const,
  propertyReservations: (propertyId: string, filters: IPropertyReservationsListQuery = {}) =>
    ["admin", "property", propertyId, "reservations", filters] as const,
};

