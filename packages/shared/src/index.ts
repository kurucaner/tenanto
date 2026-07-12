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
  ISupportAttachment,
  ISupportAttachmentInput,
  ISupportAttachmentPresignBody,
  ISupportAttachmentPresignFile,
  ISupportAttachmentPresignItem,
  ISupportAttachmentPresignResponse,
  ISupportCloseResponse,
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
  type IPropertyUnitsListQuery,
  type IPropertyUnitsListResponse,
  type IUpdatePropertyUnitBody,
  PropertyInviteStatus,
  PropertyRole,
  type TAddPropertyMemberResponse,
  type TPropertyInviteStatus,
  type TPropertyRole,
  type TPropertyUnitsListSortBy,
  type TPropertyUnitsListSortDir,
  type TUnitRentalType,
  UnitRentalType,
} from "./property-types";

// Property Settings Types
export {
  DEFAULT_PROPERTY_CHANNEL_COMMISSIONS,
  DEFAULT_PROPERTY_TAX_RATES,
  formatRateAsPercent,
  type IPropertyChannelCommission,
  type IPropertyChannelCommissionInput,
  type IPropertySettings,
  type IPropertyTaxBreakdownItem,
  type IPropertyTaxRate,
  type IPropertyTaxRateInput,
  type IUpdatePropertySettingsBody,
  percentToRate,
  rateToPercent,
  RESORT_TAX_NAME,
} from "./property-settings-types";

// Property Income Line Type Config
export {
  DEFAULT_EXTRA_CLEANING_TYPE_NAME,
  DEFAULT_PROPERTY_INCOME_LINE_TYPES,
  DEFAULT_RENT_TYPE_NAME,
  type IPropertyIncomeLineType,
  type IPropertyIncomeLineTypeInput,
  isRentIncomeLineType,
  resolveDefaultIncomeLineTypeId,
  resolveRentIncomeLineTypeId,
} from "./property-income-line-type-config";

// Property Reservation Types
export {
  type ICreatePropertyReservationBody,
  type IPropertyReservation,
  type IPropertyReservationComputedFields,
  type IPropertyReservationsListQuery,
  type IUpdatePropertyReservationBody,
  ReservationStatus,
  type TReservationStatus,
} from "./property-reservation-types";

// Property Long Stay Types
export {
  calculateLeaseEndDate,
  enumerateLeaseMonths,
  getEndLeaseMoveOutDateBounds,
  transactionDateToMonth,
  validateEndLeaseMoveOutDate,
} from "./lease-date-utils";
export {
  getCurrentLeaseRent,
  getExtensionRentEffectiveMonthOptions,
  getFirstExtensionMonth,
  getLeaseRentForMonth,
  MAX_ADDITIONAL_TERM_MONTHS,
  MAX_TOTAL_LEASE_TERM_MONTHS,
  validateExtendLease,
} from "./lease-rent-utils";
export { getLeaseOccupancyNames } from "./lease-tenant-utils";
export {
  type IPropertyExpensesListMeta,
  type IPropertyLongStaysListMeta,
  type IPropertyUnitsListMeta,
} from "./list-meta-types";
export { LEASES_LIST_LIMIT, LEASES_LIST_MAX_LIMIT } from "./property-long-stay-list-constants";
export {
  type ICreatePropertyLongStayBody,
  type IEndPropertyLongStayBody,
  type IExtendPropertyLongStayBody,
  type IPropertyLongStay,
  type IPropertyLongStayDetailResponse,
  type IPropertyLongStayRentMonth,
  type IPropertyLongStayRentPeriod,
  type IPropertyLongStaySecondaryTenant,
  type IPropertyLongStaysListQuery,
  type IPropertyLongStaysListResponse,
  type IUpdatePropertyLongStayBody,
  PropertyLongStayStatus,
  type TPropertyLongStayStatus,
} from "./property-long-stay-types";

// Property Income Line Types
export {
  type ICreatePropertyIncomeLineBody,
  IncomeEntryKind,
  type IPropertyIncomeLine,
  type IPropertyIncomeLineComputedFields,
  type IPropertyIncomeLinesListQuery,
  type IUpdatePropertyIncomeLineBody,
  PROPERTY_AMENITY_UNIT_LABEL,
  type TIncomeEntryKind,
  type TPropertyIncomeEntry,
} from "./property-income-line-types";

// Property Expense Category Type Config
export {
  DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES,
  type IPropertyExpenseCategoryType,
  type IPropertyExpenseCategoryTypeInput,
} from "./property-expense-category-type-config";

// Property Expense Types
export {
  EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_FILES,
  EXPENSE_CSV_IMPORT_MAX_ROWS_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL,
  type IExpenseCsvExtractedRow,
  type IExpenseImportCommitBody,
  type IExpenseImportCommitResponse,
  type IExpenseImportFileResult,
  type IExpenseImportParsedRow,
  type IExpenseImportParseResponse,
  type TExpenseImportFileStatus,
} from "./property-expense-import-types";
export { EXPENSES_LIST_LIMIT, EXPENSES_LIST_MAX_LIMIT } from "./property-expense-list-constants";
export {
  type ICreatePropertyExpenseBody,
  type IPropertyExpense,
  type IPropertyExpensesListQuery,
  type IPropertyExpensesListResponse,
  type IUpdatePropertyExpenseBody,
  type TPropertyExpensesListFilters,
} from "./property-expense-types";
export { UNITS_LIST_LIMIT, UNITS_LIST_MAX_LIMIT } from "./property-unit-list-constants";

// Home Financial Overview Types
export type { IHomeFinancialOverview } from "./home-financial-overview-types";

// Property Report Types
export {
  type IPortfolioPropertyReportRow,
  type IPortfolioReportSummary,
  type IPropertyReportChannelSummary,
  type IPropertyReportExpenseCategory,
  type IPropertyReportMonthSummary,
  type IPropertyReportOtherIncomeByType,
  type IPropertyReportSalesTypeBreakdown,
  type IPropertyReportsQuery,
  type IPropertyReportSummary,
  type IPropertyReportTaxSummaryItem,
  type IPropertyReportTotals,
  type IPropertyReportUnitSummary,
  ReportRentalTypeFilter,
  type TReportRentalTypeFilter,
} from "./property-report-types";

// Property report chart utilities
export {
  buildIncomeCompositionBreakdown,
  buildProfitTrendChartRows,
  buildReportChartSegments,
  buildRevenueExpenseTrendChartRows,
  calculateOperationalProfitMargin,
  channelCommissionSummaryToSegments,
  channelSummaryToSegments,
  expenseCategoryToSegments,
  type IBuildReportChartSegmentsOptions,
  type IIncomeCompositionBreakdown,
  incomeCompositionToSegments,
  type IProfitTrendChartRow,
  type IReportChartSegment,
  type IRevenueExpenseTrendChartRow,
  otherIncomeTypeToSegments,
  PROPERTY_AMENITY_UNIT_ID,
  taxSummaryToSegments,
} from "./property-report-chart-utils";

// Property income utilities
export {
  buildStayCommissionBreakdown,
  buildStayGrossBreakdown,
  buildStayNetPayoutBreakdown,
  buildStayTaxesBreakdown,
  getChannelCommissionRateFromRow,
  getResortTaxAmount,
  getStayAverageDailyRate,
  getStayCommissionBase,
  getStayNetPayout,
  getStayTaxableBase,
  getStayTaxesTotal,
  isOperandInMetric,
  type IStayCalculationBreakdown,
  type IStayCalculationLine,
  sumTaxBreakdown,
  type TBreakdownOperand,
  type TStayCalculationMetric,
  type TStayChannelBehavior,
} from "./property-income-utils";

// Property unit utilities
export { formatPropertyUnitSelectLabel, formatUnitRentalTypeLabel } from "./property-unit-utils";

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
