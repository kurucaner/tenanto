import {
  type IAppConfig,
  type IProperty,
  type IPropertyInvite,
  type IPropertyMember,
  type IPropertyUnit,
  type ISupportRequest,
  type IUser,
  type SupportCategory,
  type SupportRequestStatus,
  toIso,
  type TPropertyInviteStatus,
  type TPropertyRole,
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
  message: row.message as string,
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
