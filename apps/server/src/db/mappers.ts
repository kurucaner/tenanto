import {
  type IAppConfig,
  type ILeaseTenantMembership,
  type IProperty,
  type IPropertyChannelCommission,
  type IPropertyExpense,
  type IPropertyExpenseCategoryType,
  type IPropertyIncomeLine,
  type IPropertyIncomeLineType,
  type IPropertyInvite,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  type IPropertyLongStaySecondaryTenant,
  type IPropertyMember,
  type IPropertyReservation,
  type IPropertySettings,
  type IPropertyTaxBreakdownItem,
  type IPropertyTaxRate,
  type IPropertyUnit,
  type ISupportRequest,
  type ITenantUser,
  type IUser,
  type SupportCategory,
  type SupportRequestStatus,
  toIso,
  type TPropertyInviteStatus,
  type TPropertyRole,
  type TReservationStatus,
  type TTenantMembershipRole,
  type TTenantMembershipStatus,
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
  favoritedAt: row.favorited_at != null ? (row.favorited_at as Date).toISOString() : null,
  id: row.id as string,
  isFavorite: row.favorited_at != null,
  legalName: (row.legal_name as string) ?? null,
  memberCount: (row.member_count as number) ?? 0,
  name: row.name as string,
  phoneNumber: (row.phone_number as string) ?? null,
  unitCount: (row.unit_count as number) ?? 0,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapPropertyMemberRow = (row: Record<string, unknown>): IPropertyMember => ({
  addedBy: row.added_by == null ? null : (row.added_by as string),
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
  deletedAt: toIso(row.deleted_at),
  id: row.id as string,
  isDeleted: (row.is_deleted as boolean) ?? false,
  layout: row.layout as string,
  propertyId: row.property_id as string,
  rentalType: row.rental_type as TUnitRentalType,
  unitNumber: row.unit_number as string,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapPropertyTaxRateRow = (row: Record<string, unknown>): IPropertyTaxRate => ({
  id: row.id as string,
  name: row.name as string,
  propertyId: row.property_id as string,
  rate: Number(row.rate),
  sortOrder: Number(row.sort_order),
});

export const mapPropertyIncomeLineTypeRow = (
  row: Record<string, unknown>
): IPropertyIncomeLineType => ({
  id: row.id as string,
  name: row.name as string,
  propertyId: row.property_id as string,
  sortOrder: Number(row.sort_order),
});

export const mapPropertyExpenseCategoryTypeRow = (
  row: Record<string, unknown>
): IPropertyExpenseCategoryType => ({
  id: row.id as string,
  isAnnualAmount: row.is_annual_amount as boolean,
  name: row.name as string,
  propertyId: row.property_id as string,
  sortOrder: Number(row.sort_order),
});

export const mapPropertyChannelCommissionRow = (
  row: Record<string, unknown>
): IPropertyChannelCommission => ({
  excludeCleaningFromCommissionBase: row.exclude_cleaning_from_commission_base as boolean,
  excludeResortTaxFromPayout: row.exclude_resort_tax_from_payout as boolean,
  id: row.id as string,
  name: row.name as string,
  propertyId: row.property_id as string,
  rate: Number(row.rate),
  sortOrder: Number(row.sort_order),
});

export const mapPropertySettingsRow = (
  row: Record<string, unknown>
): Omit<
  IPropertySettings,
  "channelCommissions" | "expenseCategoryTypes" | "incomeLineTypes" | "taxRates"
> => ({
  createdAt: (row.created_at as Date).toISOString(),
  propertyId: row.property_id as string,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const parseTaxBreakdown = (raw: unknown): IPropertyTaxBreakdownItem[] => {
  if (!Array.isArray(raw)) return [];

  const items: IPropertyTaxBreakdownItem[] = [];
  for (const entry of raw) {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const taxRateId = record["taxRateId"];
    const name = record["name"];
    const rate = record["rate"];
    const amount = record["amount"];
    if (typeof taxRateId !== "string" || typeof name !== "string") {
      continue;
    }
    const parsedRate = typeof rate === "number" ? rate : Number(rate);
    const parsedAmount = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(parsedRate) || !Number.isFinite(parsedAmount)) {
      continue;
    }
    items.push({ amount: parsedAmount, name, rate: parsedRate, taxRateId });
  }
  return items;
};

const formatDateColumn = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const toRequiredIso = (value: unknown): string => {
  const iso = toIso(value);
  if (iso == null) {
    throw new TypeError("Invalid timestamp");
  }
  return iso;
};

export const mapPropertyReservationRow = (row: Record<string, unknown>): IPropertyReservation => ({
  channelCommission: Number(row.channel_commission),
  channelCommissionId: row.channel_commission_id as string,
  channelCommissionRate: Number(row.channel_commission_rate),
  channelName: row.channel_name as string,
  checkIn: formatDateColumn(row.check_in),
  checkOut: formatDateColumn(row.check_out),
  cleaningFee: Number(row.cleaning_fee),
  createdAt: toRequiredIso(row.created_at),
  deletedAt: toIso(row.deleted_at),
  excludeCleaningFromCommissionBase: row.exclude_cleaning_from_commission_base as boolean,
  excludeResortTaxFromPayout: row.exclude_resort_tax_from_payout as boolean,
  grossIncome: Number(row.gross_income),
  guestName: row.guest_name as string,
  id: row.id as string,
  isDeleted: (row.is_deleted as boolean) ?? false,
  netIncome: Number(row.net_income),
  nights: row.nights as number,
  propertyId: row.property_id as string,
  refundedAmount:
    row.refunded_amount != null && row.refunded_amount !== undefined
      ? Number(row.refunded_amount)
      : null,
  refundedAt: toIso(row.refunded_at),
  refundedBy: (row.refunded_by as string | null) ?? null,
  reservationNumber: (row.reservation_number as string) ?? null,
  roomTotal: Number(row.room_total),
  status: row.status as TReservationStatus,
  taxBreakdown: parseTaxBreakdown(row.tax_breakdown),
  unitId: row.unit_id as string,
  updatedAt: toRequiredIso(row.updated_at),
});

export const parseSecondaryTenants = (raw: unknown): IPropertyLongStaySecondaryTenant[] => {
  if (!Array.isArray(raw)) return [];
  const tenants: IPropertyLongStaySecondaryTenant[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || record.name.trim() === "") continue;
    tenants.push({
      email: typeof record.email === "string" ? record.email : null,
      name: record.name.trim(),
      phone: typeof record.phone === "string" ? record.phone : null,
    });
  }
  return tenants;
};

export const mapPropertyLongStayRentPeriodRow = (
  row: Record<string, unknown>
): IPropertyLongStayRentPeriod => ({
  effectiveFromMonth: String(row.effective_from_month),
  monthlyRent: Number(row.monthly_rent),
});

export const mapPropertyLongStayRow = (row: Record<string, unknown>): IPropertyLongStay => ({
  actualEndDate: row.actual_end_date ? formatDateColumn(row.actual_end_date) : null,
  createdAt: (row.created_at as Date).toISOString(),
  guestName: row.guest_name as string,
  id: row.id as string,
  leaseEndDate: formatDateColumn(row.lease_end_date),
  leaseStartDate: formatDateColumn(row.lease_start_date),
  monthlyRent: Number(row.monthly_rent),
  propertyId: row.property_id as string,
  secondaryTenants: parseSecondaryTenants(row.secondary_tenants),
  status: row.status as IPropertyLongStay["status"],
  tenantEmail: (row.tenant_email as string | null) ?? null,
  tenantPhone: (row.tenant_phone as string | null) ?? null,
  termMonths: row.term_months as number,
  unitId: row.unit_id as string,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapPropertyIncomeLineRow = (row: Record<string, unknown>): IPropertyIncomeLine => ({
  amount: Number(row.amount),
  channelCommission: Number(row.channel_commission),
  createdAt: toRequiredIso(row.created_at),
  deletedAt: toIso(row.deleted_at),
  description: (row.description as string) ?? null,
  grossIncome: Number(row.gross_income),
  guestName: (row.guest_name as string) ?? null,
  id: row.id as string,
  incomeLineTypeId: row.income_line_type_id as string,
  incomeLineTypeName:
    typeof row.income_line_type_name === "string" ? row.income_line_type_name : undefined,
  isDeleted: (row.is_deleted as boolean) ?? false,
  longStayId: (row.long_stay_id as string | null) ?? null,
  netIncome: Number(row.net_income),
  propertyId: row.property_id as string,
  refundedAmount:
    row.refunded_amount != null && row.refunded_amount !== undefined
      ? Number(row.refunded_amount)
      : null,
  refundedAt: toIso(row.refunded_at),
  refundedBy: (row.refunded_by as string | null) ?? null,
  rentPeriodMonth: typeof row.rent_period_month === "string" ? row.rent_period_month : null,
  reservationId: (row.reservation_id as string) ?? null,
  taxBreakdown: parseTaxBreakdown(row.tax_breakdown),
  tenantRentPaymentId: (row.tenant_rent_payment_id as string | null) ?? null,
  transactionDate: formatDateColumn(row.transaction_date),
  unitId: (row.unit_id as string | null) ?? null,
  updatedAt: toRequiredIso(row.updated_at),
});

export const mapPropertyExpenseRow = (row: Record<string, unknown>): IPropertyExpense => ({
  amount: Number(row.amount),
  categoryId: row.category_id as string,
  categoryIsAnnualAmount: row.is_annual_amount as boolean,
  categoryName: row.category_name as string,
  createdAt: (row.created_at as Date).toISOString(),
  deletedAt: toIso(row.deleted_at),
  description: (row.description as string) ?? null,
  expenseDate: row.expense_date == null ? null : formatDateColumn(row.expense_date),
  id: row.id as string,
  isDeleted: (row.is_deleted as boolean) ?? false,
  propertyId: row.property_id as string,
  taxFree: row.tax_free as boolean,
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapTenantUserRow = (row: Record<string, unknown>): ITenantUser => ({
  createdAt: (row.created_at as Date).toISOString(),
  email: row.email as string,
  emailVerifiedAt: toIso(row.email_verified_at),
  id: row.id as string,
  name: row.name as string,
  phone: (row.phone as string) ?? null,
  phoneVerifiedAt: toIso(row.phone_verified_at),
  updatedAt: (row.updated_at as Date).toISOString(),
});

export const mapLeaseTenantMembershipRow = (
  row: Record<string, unknown>
): ILeaseTenantMembership => ({
  acceptedAt: toIso(row.accepted_at),
  createdAt: (row.created_at as Date).toISOString(),
  declinedAt: toIso(row.declined_at),
  displayName: row.display_name as string,
  endedAt: toIso(row.ended_at),
  expiresAt: (row.expires_at as Date).toISOString(),
  id: row.id as string,
  invitedAt: (row.invited_at as Date).toISOString(),
  invitedBy: row.invited_by as string,
  inviteEmail: row.invite_email as string,
  leaseId: row.lease_id as string,
  revokedAt: toIso(row.revoked_at),
  role: row.role as TTenantMembershipRole,
  status: row.status as TTenantMembershipStatus,
  tenantUserId: (row.tenant_user_id as string) ?? null,
  updatedAt: (row.updated_at as Date).toISOString(),
});
