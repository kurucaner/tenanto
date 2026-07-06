// Re-export all types from organized modules

// Status Codes
export { AccountError, HttpStatus, JwtError } from "./status-enums";

// User Types
export type { IUser } from "./user";
export { UserType } from "./user";

// Admin audit
export {
  AdminAuditAction,
  type IAdminAuditEvent,
  type IAdminAuditEventsListQuery,
  type IAdminAuditEventsListResponse,
  type TAdminAuditAction,
} from "./admin-audit-types";
export type { IAdminPlatformStats } from "./admin-platform-stats-types";

// Notification Types
export type {
  INotificationStreamConnectedData,
  INotificationStreamEvent,
  INotificationStreamNewData,
  INotificationStreamSupportAttachmentUpdatedData,
  INotificationStreamSupportRequestUpdatedData,
  INotificationStreamUnreadCountData,
  NotificationStreamEventType,
} from "./notification-stream-types";
export type {
  IUserNotification,
  IUserNotificationsListQuery,
  IUserNotificationsListResponse,
  IUserNotificationsMarkAllReadResponse,
  IUserNotificationsUnreadCountResponse,
  UserNotificationResourceType,
  UserNotificationType,
} from "./notification-types";

// Support Types
export type {
  IAdminSupportRequestListItem,
  IAdminSupportRequestPatchBody,
  IAdminSupportRequestPatchResponse,
  IAdminSupportRequestsListQuery,
  IAdminSupportRequestsListResponse,
  ISupportAttachment,
  ISupportAttachmentInput,
  ISupportAttachmentPresignBody,
  ISupportAttachmentPresignFile,
  ISupportAttachmentPresignItem,
  ISupportAttachmentPresignResponse,
  ISupportCreateBody,
  ISupportMessage,
  ISupportMessageCreateBody,
  ISupportRequest,
  ISupportRequestDetail,
  ISupportRequestListItem,
  ISupportRequestsListQuery,
  ISupportRequestsListResponse,
  SupportCategory,
  SupportRequestStatus,
  TAdminSupportRequestSettableStatus,
  TSupportAllowedImageMimeType,
  TSupportStagedUploadStatus,
} from "./support-types";
export {
  SUPPORT_ALLOWED_IMAGE_MIME_TYPES,
  SUPPORT_MAX_IMAGE_ATTACHMENTS,
  SUPPORT_MAX_IMAGE_BYTES,
} from "./support-types";

// App Config Types
export type {
  IAdminPatchAppConfigBody,
  IAppConfig,
  IInitResponse,
  TPlatform,
} from "./app-config-types";

// Property Types
export {
  type IAdminAddPropertyMemberBody,
  type IAdminCreatePropertyBody,
  type IAdminPropertiesListQuery,
  type IAdminPropertiesListResponse,
  type IAdminUpdatePropertyBody,
  type IAdminUpdatePropertyMemberBody,
  type ICreatePropertyUnitBody,
  type IProperty,
  type IPropertyDetail,
  type IPropertyInvite,
  type IPropertyMember,
  type IPropertyMemberUser,
  type IPropertyUnit,
  type IUpdatePropertyUnitBody,
  PropertyInviteStatus,
  PropertyRole,
  type TAddPropertyMemberResponse,
  type TPropertyInviteStatus,
  type TPropertyRole,
  type TUnitRentalType,
  UnitRentalType,
} from "./property-types";

// Property Settings Types
export {
  DEFAULT_PROPERTY_SETTINGS,
  formatRateAsPercent,
  type IPropertySettings,
  type IPropertySettingsDefaults,
  type IUpdatePropertySettingsBody,
  percentToRate,
  rateToPercent,
} from "./property-settings-types";

// Property Reservation Types
export {
  type ICreatePropertyReservationBody,
  type IPropertyReservation,
  type IPropertyReservationComputedFields,
  type IPropertyReservationsListQuery,
  type IUpdatePropertyReservationBody,
  ReservationChannel,
  ReservationStatus,
  type TReservationChannel,
  type TReservationStatus,
} from "./property-reservation-types";

// Property Income Line Types
export {
  type ICreatePropertyIncomeLineBody,
  IncomeEntryKind,
  IncomeLineType,
  type IPropertyIncomeLine,
  type IPropertyIncomeLineComputedFields,
  type IPropertyIncomeLinesListQuery,
  type IUpdatePropertyIncomeLineBody,
  type TIncomeEntryKind,
  type TIncomeLineType,
  type TPropertyIncomeEntry,
} from "./property-income-line-types";

// Property Expense Types
export {
  ExpenseCategory,
  getExpenseCategoryMeta,
  type ICreatePropertyExpenseBody,
  type IExpenseCategoryMeta,
  type IPropertyExpense,
  type IPropertyExpensesListQuery,
  type IUpdatePropertyExpenseBody,
  type TExpenseCategory,
  validateExpenseCategoryFields,
} from "./property-expense-types";

// Home Financial Overview Types
export type { IHomeFinancialOverview } from "./home-financial-overview-types";

// Property Report Types
export {
  type IPortfolioPropertyReportRow,
  type IPortfolioReportSummary,
  type IPropertyReportChannelSummary,
  type IPropertyReportExpenseCategory,
  type IPropertyReportMonthSummary,
  type IPropertyReportSalesTypeBreakdown,
  type IPropertyReportsQuery,
  type IPropertyReportSummary,
  type IPropertyReportTotals,
  type IPropertyReportUnitSummary,
  ReportRentalTypeFilter,
  type TReportRentalTypeFilter,
} from "./property-report-types";

// Helpers
export { sleep, toIso } from "./helpers";

// Phone utilities
export {
  type CountryCode,
  formatNationalAsYouType,
  formatPhoneDisplay,
  getMaxNationalDigits,
  getPhoneCountryOptions,
  type IPhoneCountryOption,
  type IPhoneParts,
  isValidE164,
  isValidPhone,
  normalizeToE164,
  parsePhoneToParts,
  PHONE_DEFAULT_COUNTRY,
  toE164,
} from "./phone";

// Brand Constants
export { APP_NAME, APP_SLUG, SUPPORT_EMAIL } from "./constants";

// Storage migration
export { migrateLocalStorageKey } from "./migrate-storage-key";
