import type { IAdminPropertiesListQuery, IAdminUsersListQuery } from "@/lib/api-client";
import type {
  IAdminAuditEventsListQuery,
  IPropertyExpensesListQuery,
  IPropertyIncomeLinesListQuery,
  IPropertyLongStaysListQuery,
  IPropertyReportsQuery,
  IPropertyReservationsListQuery,
  ISupportRequestsListQuery,
} from "@/packages/shared";

export const adminQueryKeys = {
  appConfig: () => ["app-config"] as const,
  platformStats: () => ["platform-stats"] as const,
  auditLog: (filters: Omit<IAdminAuditEventsListQuery, "cursor" | "limit">) =>
    ["activity", filters] as const,
  user: (userId: string) => ["user", userId] as const,
  userAudit: (userId: string) => ["user", userId, "audit"] as const,
  usersList: (filters: Omit<IAdminUsersListQuery, "cursor">) => ["users", filters] as const,
  notificationBroadcastHistory: () => ["notification-broadcasts", "history"] as const,
  supportRequestsList: (filters: Omit<ISupportRequestsListQuery, "cursor" | "limit">) =>
    ["support-requests", filters] as const,
  supportRequest: (id: string) => ["support", "request", id] as const,
  userSupportList: (filters: Omit<ISupportRequestsListQuery, "cursor" | "limit">) =>
    ["support", "list", filters] as const,
  propertiesList: (filters: Omit<IAdminPropertiesListQuery, "cursor">) =>
    ["properties", filters] as const,
  propertyDetail: (propertyId: string) => ["property", propertyId] as const,
  propertyUnits: (propertyId: string) => ["property", propertyId, "units"] as const,
  propertyUnitsPicker: (propertyId: string) => ["property", propertyId, "units-picker"] as const,
  propertyReservationPicker: (propertyId: string, filters: IPropertyReservationsListQuery = {}) =>
    ["property", propertyId, "reservation-picker", filters] as const,
  propertySettings: (propertyId: string) => ["property", propertyId, "settings"] as const,
  propertyReservations: (propertyId: string, filters: IPropertyReservationsListQuery = {}) =>
    ["property", propertyId, "reservations", filters] as const,
  propertyIncomeLines: (propertyId: string, filters: IPropertyIncomeLinesListQuery = {}) =>
    ["property", propertyId, "income-lines", filters] as const,
  propertyExpenses: (propertyId: string, filters: IPropertyExpensesListQuery = {}) =>
    ["property", propertyId, "expenses", filters] as const,
  propertyLongStays: (propertyId: string, filters: IPropertyLongStaysListQuery = {}) =>
    ["property", propertyId, "long-stays", filters] as const,
  propertyLongStay: (propertyId: string, longStayId: string) =>
    ["property", propertyId, "long-stays", longStayId] as const,
  propertyReportSummary: (propertyId: string, filters: IPropertyReportsQuery) =>
    ["property", propertyId, "reports", filters] as const,
  portfolioReportSummary: (filters: IPropertyReportsQuery) =>
    ["portfolio", "reports", filters] as const,
  homeFinancialOverview: () => ["home", "financial-overview"] as const,
  notificationsUnreadCount: () => ["notifications", "unread-count"] as const,
  notificationsList: () => ["notifications", "list"] as const,
};
