import type { IPropertyUnitsListMeta } from "./list-meta-types";

export const PropertyRole = {
  ACCOUNTANT: "accountant",
  MANAGER: "manager",
  OWNER: "owner",
} as const;

export type TPropertyRole = (typeof PropertyRole)[keyof typeof PropertyRole];

export interface IProperty {
  address: string;
  createdAt: string;
  createdBy: string;
  favoritedAt: string | null;
  id: string;
  isFavorite: boolean;
  legalName: string | null;
  memberCount: number;
  name: string;
  phoneNumber: string | null;
  unitCount: number;
  updatedAt: string;
}

export interface IPropertyMemberUser {
  email: string;
  id: string;
  name: string;
}

export interface IPropertyMember {
  addedBy: string | null;
  createdAt: string;
  id: string;
  propertyId: string;
  role: TPropertyRole;
  updatedAt: string;
  user: IPropertyMemberUser;
  userId: string;
}

export interface IPropertyDetail extends IProperty {
  creator: IPropertyMemberUser;
  members: IPropertyMember[];
}

export interface IAdminPropertiesListResponse {
  items: IProperty[];
  nextCursor: string | null;
}

export interface IAdminPropertiesListQuery {
  cursor?: string;
  limit?: number;
  q?: string;
}

export interface IAdminCreatePropertyBody {
  address: string;
  legalName?: string;
  name: string;
  phoneNumber?: string;
}

export interface IAdminUpdatePropertyBody {
  address?: string;
  legalName?: string | null;
  name?: string;
  phoneNumber?: string | null;
}

export interface IAdminSetPropertyFavoriteBody {
  favorite: boolean;
}

export interface IAdminAddPropertyMemberBody {
  email: string;
  role: TPropertyRole;
}

export interface IAdminUpdatePropertyMemberBody {
  role: TPropertyRole;
}

export const UnitRentalType = {
  LONG_TERM: "long_term",
  SHORT_TERM: "short_term",
} as const;

export type TUnitRentalType = (typeof UnitRentalType)[keyof typeof UnitRentalType];

export interface IPropertyUnit {
  createdAt: string;
  deletedAt: string | null;
  id: string;
  isDeleted: boolean;
  layout: string;
  propertyId: string;
  rentalType: TUnitRentalType;
  unitNumber: string;
  updatedAt: string;
}

export interface ICreatePropertyUnitBody {
  layout: string;
  rentalType: TUnitRentalType;
  unitNumber: string;
}

export interface IUpdatePropertyUnitBody {
  layout?: string;
  rentalType?: TUnitRentalType;
  unitNumber?: string;
}

export type TPropertyUnitsListSortBy = "type";
export type TPropertyUnitsListSortDir = "asc" | "desc";

export const UnitOccupancyFilter = {
  OCCUPIED: "occupied",
  VACANT: "vacant",
} as const;

export type TUnitOccupancyFilter = (typeof UnitOccupancyFilter)[keyof typeof UnitOccupancyFilter];

export const UNIT_OCCUPANCY_FILTER_VALUES = Object.values(UnitOccupancyFilter);

export type TPropertyUnitsListFilters = {
  from?: string;
  occupancy?: TUnitOccupancyFilter;
  q?: string;
  rentalType?: TUnitRentalType;
  sortBy?: TPropertyUnitsListSortBy;
  sortDir?: TPropertyUnitsListSortDir;
  to?: string;
};

export interface IPropertyUnitsListQuery extends TPropertyUnitsListFilters {
  cursor?: string;
  limit?: number;
}

export interface IPropertyUnitsListResponse {
  meta?: IPropertyUnitsListMeta;
  nextCursor: string | null;
  units: IPropertyUnit[];
}

export const PropertyInviteStatus = {
  ACCEPTED: "accepted",
  EMAIL_FAILED: "email_failed",
  PENDING: "pending",
} as const;

export type TPropertyInviteStatus =
  (typeof PropertyInviteStatus)[keyof typeof PropertyInviteStatus];

export interface IPropertyInvite {
  createdAt: string;
  email: string;
  emailError: string | null;
  expiresAt: string;
  id: string;
  invitedBy: string;
  propertyId: string;
  role: TPropertyRole;
  status: TPropertyInviteStatus;
}

export type TAddPropertyMemberResponse =
  | { member: IPropertyMember; type: "member_added" }
  | { invite: IPropertyInvite; type: "invite_sent" }
  | { invite: IPropertyInvite; type: "invite_email_failed" };
