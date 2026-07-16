import type { IAdminPropertiesListQuery, IAdminUsersListQuery } from "@/lib/api-client";
import type {
  IAdminAuditEventsListQuery,
  IPropertyExpensesListQuery,
  IPropertyExportsListQuery,
  IPropertyIncomeLinesListQuery,
  IPropertyLongStaysListQuery,
  IPropertyReportsQuery,
  IPropertyReservationsListQuery,
  IPropertyUnitsListQuery,
  ISupportRequestsListQuery,
  ITenantEmailCampaignsListQuery,
  TPropertyIncomeEntriesListFilters,
} from "@/packages/shared";

export const queryKeys = {
  appConfig: () => ["app-config"] as const,
  auditLog: (filters: Omit<IAdminAuditEventsListQuery, "cursor" | "limit">) =>
    ["activity", filters] as const,
  homeFinancialOverview: () => ["home", "financial-overview"] as const,
  notificationBroadcastHistory: () => ["notification-broadcasts", "history"] as const,
  notificationsList: () => ["notifications", "list"] as const,
  notificationsUnreadCount: () => ["notifications", "unread-count"] as const,
  platformStats: () => ["platform-stats"] as const,
  portfolioReportSummary: (filters: IPropertyReportsQuery) =>
    ["portfolio", "reports", filters] as const,
  propertiesList: (filters: Omit<IAdminPropertiesListQuery, "cursor">) =>
    ["properties", filters] as const,
  propertyActiveLeases: (propertyId: string) => ["property", propertyId, "active-leases"] as const,
  propertyDetail: (propertyId: string) => ["property", propertyId] as const,
  propertyExpenses: (propertyId: string, filters: IPropertyExpensesListQuery = {}) =>
    ["property", propertyId, "expenses", filters] as const,
  propertyExport: (propertyId: string, jobId: string) =>
    ["property", propertyId, "exports", jobId] as const,
  propertyExports: (
    propertyId: string,
    filters: Omit<IPropertyExportsListQuery, "cursor" | "limit"> = {}
  ) => ["property", propertyId, "exports", filters] as const,
  propertyExportsPrefix: (propertyId: string) => ["property", propertyId, "exports"] as const,
  propertyIncomeEntries: (propertyId: string, filters: TPropertyIncomeEntriesListFilters = {}) =>
    ["property", propertyId, "income-entries", filters] as const,
  propertyIncomeEntriesPrefix: (propertyId: string) =>
    ["property", propertyId, "income-entries"] as const,
  propertyIncomeLines: (
    propertyId: string,
    filters: Omit<IPropertyIncomeLinesListQuery, "cursor" | "limit"> = {}
  ) => ["property", propertyId, "income-lines", filters] as const,
  propertyLongStay: (propertyId: string, longStayId: string) =>
    ["property", propertyId, "long-stays", longStayId] as const,
  propertyLongStayPortalAccess: (propertyId: string, longStayId: string) =>
    ["property", propertyId, "long-stays", longStayId, "portal-access"] as const,
  propertyLongStays: (propertyId: string, filters: IPropertyLongStaysListQuery = {}) =>
    ["property", propertyId, "long-stays", filters] as const,
  propertyReportSummary: (propertyId: string, filters: IPropertyReportsQuery) =>
    ["property", propertyId, "reports", filters] as const,
  propertyReservationPicker: (propertyId: string, filters: IPropertyReservationsListQuery = {}) =>
    ["property", propertyId, "reservation-picker", filters] as const,
  propertySettings: (propertyId: string) => ["property", propertyId, "settings"] as const,
  propertyShortStays: (
    propertyId: string,
    filters: Omit<IPropertyReservationsListQuery, "cursor" | "limit"> = {}
  ) => ["property", propertyId, "short-stays", filters] as const,
  propertyStripeConnectStatus: (propertyId: string) =>
    ["property", propertyId, "stripe-connect", "status"] as const,
  propertyTenantEmailCampaign: (propertyId: string, campaignId: string) =>
    ["property", propertyId, "tenant-email-campaigns", campaignId] as const,
  propertyTenantEmailCampaigns: (
    propertyId: string,
    filters: Omit<ITenantEmailCampaignsListQuery, "cursor" | "limit"> = {}
  ) => ["property", propertyId, "tenant-email-campaigns", filters] as const,
  propertyUnits: (propertyId: string, filters: IPropertyUnitsListQuery = {}) =>
    ["property", propertyId, "units", filters] as const,
  propertyUnitsPicker: (propertyId: string) => ["property", propertyId, "units-picker"] as const,
  supportRequest: (id: string) => ["support", "request", id] as const,
  supportRequestsList: (filters: Omit<ISupportRequestsListQuery, "cursor" | "limit">) =>
    ["support-requests", filters] as const,
  user: (userId: string) => ["user", userId] as const,
  userAudit: (userId: string) => ["user", userId, "audit"] as const,
  usersList: (filters: Omit<IAdminUsersListQuery, "cursor">) => ["users", filters] as const,
  userSupportList: (filters: Omit<ISupportRequestsListQuery, "cursor" | "limit">) =>
    ["support", "list", filters] as const,
};
