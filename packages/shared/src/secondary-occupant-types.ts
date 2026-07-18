import type { ILeaseSecondaryTenantContact } from "./lease-secondary-tenant-contact";
import type { ILeaseTenantMembership } from "./tenant-portal-types";

export const MAX_SECONDARY_OCCUPANTS = 10;

export interface ICreateSecondaryOccupantBody {
  email?: string | null;
  name: string;
  phone?: string | null;
}

export interface IUpdateSecondaryOccupantBody {
  email?: string | null;
  name?: string;
  phone?: string | null;
}

export interface ISecondaryOccupantMutationResponse {
  contact: ILeaseSecondaryTenantContact;
  membership: ILeaseTenantMembership;
}

export interface ICreateSecondaryOccupantResponse {
  secondaryOccupant: ISecondaryOccupantMutationResponse;
}

export interface IUpdateSecondaryOccupantResponse {
  secondaryOccupant: ISecondaryOccupantMutationResponse;
}

export interface IDeleteSecondaryOccupantResponse {
  membership: ILeaseTenantMembership;
}
