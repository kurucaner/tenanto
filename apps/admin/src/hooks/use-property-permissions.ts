import { useMemo } from "react";

import type {
  IProperty,
  IPropertyDetail,
  IPropertyMember,
  IUser,
  TPropertyRole,
} from "@/packages/shared";
import { PropertyRole, UserType } from "@/packages/shared";

export interface IPropertyPermissions {
  callerMembership?: IPropertyMember;
  canManageLedger: boolean;
  canManageMembers: boolean;
  canManageStripeConnect: boolean;
  canManageStructure: boolean;
  canManageUnits: boolean;
  canSendTenantNotifications: boolean;
  canView: boolean;
  isAdmin: boolean;
  isCreator: boolean;
}

function buildPropertyPermissions(input: {
  callerMembership?: IPropertyMember;
  callerRole: TPropertyRole | null;
  isAdmin: boolean;
  isCreator: boolean;
}): IPropertyPermissions {
  const isOwnerMember = input.callerRole === PropertyRole.OWNER;
  const isManagerMember = input.callerRole === PropertyRole.MANAGER;
  const canManageStructure = input.isAdmin || input.isCreator || isOwnerMember;
  const canManageStripeConnect = input.isAdmin || isOwnerMember;
  const canManageUnits = input.isAdmin || input.isCreator || isOwnerMember || isManagerMember;
  const canManageLedger = input.isAdmin || input.isCreator || isOwnerMember || isManagerMember;
  const canView = input.isAdmin || input.isCreator || input.callerRole != null;
  const canSendTenantNotifications = input.isAdmin || input.isCreator || isOwnerMember;

  return {
    callerMembership: input.callerMembership,
    canManageLedger,
    canManageMembers: canManageStructure,
    canManageStripeConnect,
    canManageStructure,
    canManageUnits,
    canSendTenantNotifications,
    canView,
    isAdmin: input.isAdmin,
    isCreator: input.isCreator,
  };
}

export function derivePropertyPermissions(
  property: IPropertyDetail | undefined,
  currentUser: IUser | null | undefined
): IPropertyPermissions {
  const isAdmin = currentUser?.userType === UserType.ADMIN;
  const isCreator = Boolean(property && currentUser && property.createdBy === currentUser.id);
  const callerMembership = property?.members.find((member) => member.userId === currentUser?.id);

  return buildPropertyPermissions({
    callerMembership,
    callerRole: callerMembership?.role ?? null,
    isAdmin,
    isCreator,
  });
}

export function derivePropertyPermissionsFromListItem(
  property: IProperty,
  currentUser: IUser | null | undefined
): IPropertyPermissions {
  const isAdmin = currentUser?.userType === UserType.ADMIN;
  const isCreator = Boolean(currentUser && property.createdBy === currentUser.id);

  return buildPropertyPermissions({
    callerRole: property.callerRole,
    isAdmin,
    isCreator,
  });
}

export function usePropertyPermissions(
  property: IPropertyDetail | undefined,
  currentUser: IUser | null | undefined
): IPropertyPermissions {
  return useMemo(() => derivePropertyPermissions(property, currentUser), [currentUser, property]);
}
