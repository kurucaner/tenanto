import {
  type IAppConfig,
  type IProperty,
  type IPropertyExpense,
  type IPropertyIncomeLine,
  type IPropertyInvite,
  type IPropertyMember,
  type IPropertyReservation,
  type IPropertySettings,
  type IPropertyUnit,
  type ISupportRequest,
  type IUser,
  type SupportCategory,
  type SupportRequestStatus,
  type TExpenseCategory,
  type TIncomeLineType,
  toIso,
  type TPropertyInviteStatus,
  type TPropertyRole,
  type TReservationChannel,
  type TReservationStatus,
  type TUnitRentalType,
  UserType,
} from "@/packages/shared";

export const mapUserRow = (row: Record<string, unknown>): IUser => ({
  appleId: (row.apple_id as string) ?? null,
  createdAt: (row.created_at as Date).toISOString(),
  email: row.email as string,
  googleId: (row.google_id as string) ?? null,
  id: row.id as string,
  name: row.name as string,
  onboardingCompletedAt: toIso(row.onboarding_completed_at),
  updatedAt: (row.updated_at as Date).toISOString(),
  userType: ((row.user_type as string) ?? UserType.USER) as UserType,
});

export const mapAppConfigRow = (row: Record<string, unknown>): IAppConfig => ({
  appStoreUrl: (row.app_store_url as string) ?? null,
  id: row.id as number,
  maintenanceMode: row.maintenance_mode as boolean,
  minAndroidAppVersion: row.min_android_app_version as string,
  minIosAppVersion: row.min_ios_app_version as string,
  playStoreUrl: (row.play_store_url as string) ?? null,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapSupportRequestRow = (row: Record<string, unknown>): ISupportRequest => ({
  category: row.category as SupportCategory,
  createdAt: (row.created_at as Date).toISOString(),
  id: row.id as string,
  status: row.status as SupportRequestStatus,
  updatedAt: (row.updated_at as Date).toISOString(),
  userId: row.user_id as string,
});

export const mapPropertyRow = (row: Record<string, unknown>): IProperty => ({
  address: row.address as string,
  createdAt: (row.created_at as Date).toISOString(),
  createdBy: row.created_by as string,
  id: row.id as string,
  memberCount: (row.member_count as number) ?? 0,
  name: row.name as string,
  phoneNumber: (row.phone_number as string) ?? null,
  unitCount: (row.unit_count as number) ?? 0,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapPropertyMemberRow = (row: Record<string, unknown>): IPropertyMember => ({
  addedBy: row.added_by as string,
  createdAt: (row.created_at as Date).toISOString(),
  id: row.id as string,
  propertyId: row.property_id as string,
  role: row.role as TPropertyRole,
  updatedAt: (row.updated_at as Date).toISOString(),
  user: {
    email: row.user_email as string,
    id: row.user_id as string,
    name: row.user_name as string,
  },
  userId: row.user_id as string,
});

export const mapPropertyInviteRow = (row: Record<string, unknown>): IPropertyInvite => ({
  createdAt: (row.created_at as Date).toISOString(),
  email: row.email as string,
  emailError: (row.email_error as string) ?? null,
  expiresAt: (row.expires_at as Date).toISOString(),
  id: row.id as string,
  invitedBy: row.invited_by as string,
  propertyId: row.property_id as string,
  role: row.role as TPropertyRole,
  status: row.status as TPropertyInviteStatus,
});

export const mapPropertyUnitRow = (row: Record<string, unknown>): IPropertyUnit => ({
  createdAt: (row.created_at as Date).toISOString(),
  id: row.id as string,
  layout: row.layout as string,
  propertyId: row.property_id as string,
  rentalType: row.rental_type as TUnitRentalType,
  unitNumber: row.unit_number as string,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapPropertySettingsRow = (row: Record<string, unknown>): IPropertySettings => ({
  airbnbCommissionRate: Number(row.airbnb_commission_rate),
  bookingCommissionRate: Number(row.booking_commission_rate),
  conventionDevelopmentTaxRate: Number(row.convention_development_tax_rate),
  createdAt: (row.created_at as Date).toISOString(),
  directCommissionRate: Number(row.direct_commission_rate),
  expediaCommissionRate: Number(row.expedia_commission_rate),
  miamiDadeSurtaxRate: Number(row.miami_dade_surtax_rate),
  propertyId: row.property_id as string,
  resortTaxRate: Number(row.resort_tax_rate),
  salesTaxRate: Number(row.sales_tax_rate),
  updatedAt: (row.updated_at as Date).toISOString(),
});

const formatDateColumn = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

export const mapPropertyReservationRow = (row: Record<string, unknown>): IPropertyReservation => ({
  channel: row.channel as TReservationChannel,
  channelCommission: Number(row.channel_commission),
  checkIn: formatDateColumn(row.check_in),
  checkOut: formatDateColumn(row.check_out),
  cleaningFee: Number(row.cleaning_fee),
  conventionDevelopmentTax: Number(row.convention_development_tax),
  createdAt: (row.created_at as Date).toISOString(),
  grossIncome: Number(row.gross_income),
  guestName: row.guest_name as string,
  id: row.id as string,
  miamiDadeSurtax: Number(row.miami_dade_surtax),
  netIncome: Number(row.net_income),
  nights: row.nights as number,
  propertyId: row.property_id as string,
  reservationNumber: (row.reservation_number as string) ?? null,
  resortTax: Number(row.resort_tax),
  roomRate: Number(row.room_rate),
  salesTax: Number(row.sales_tax),
  status: row.status as TReservationStatus,
  unitId: row.unit_id as string,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapPropertyIncomeLineRow = (row: Record<string, unknown>): IPropertyIncomeLine => ({
  amount: Number(row.amount),
  channelCommission: Number(row.channel_commission),
  conventionDevelopmentTax: Number(row.convention_development_tax),
  createdAt: (row.created_at as Date).toISOString(),
  description: (row.description as string) ?? null,
  grossIncome: Number(row.gross_income),
  guestName: (row.guest_name as string) ?? null,
  id: row.id as string,
  lineType: row.line_type as TIncomeLineType,
  miamiDadeSurtax: Number(row.miami_dade_surtax),
  netIncome: Number(row.net_income),
  propertyId: row.property_id as string,
  reservationId: (row.reservation_id as string) ?? null,
  resortTax: Number(row.resort_tax),
  salesTax: Number(row.sales_tax),
  transactionDate: formatDateColumn(row.transaction_date),
  unitId: row.unit_id as string,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapPropertyExpenseRow = (row: Record<string, unknown>): IPropertyExpense => ({
  amount: Number(row.amount),
  category: row.category as TExpenseCategory,
  createdAt: (row.created_at as Date).toISOString(),
  description: (row.description as string) ?? null,
  expenseDate: row.expense_date == null ? null : formatDateColumn(row.expense_date),
  id: row.id as string,
  personName: (row.person_name as string) ?? null,
  propertyId: row.property_id as string,
  updatedAt: (row.updated_at as Date).toISOString(),
});
