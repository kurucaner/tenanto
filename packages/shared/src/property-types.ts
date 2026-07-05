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
  id: string;
  memberCount: number;
  name: string;
  phoneNumber: string | null;
  updatedAt: string;
}

export interface IPropertyMemberUser {
  email: string;
  id: string;
  name: string;
}

export interface IPropertyMember {
  addedBy: string;
  createdAt: string;
  id: string;
  propertyId: string;
  role: TPropertyRole;
  updatedAt: string;
  user: IPropertyMemberUser;
  userId: string;
}

export interface IPropertyDetail extends IProperty {
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
  name: string;
  phoneNumber?: string;
}

export interface IAdminUpdatePropertyBody {
  address?: string;
  name?: string;
  phoneNumber?: string | null;
}

export interface IAdminAddPropertyMemberBody {
  role: TPropertyRole;
  userId: string;
}

export interface IAdminUpdatePropertyMemberBody {
  role: TPropertyRole;
}
