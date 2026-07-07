import { useMemo } from "react";

import type { IPropertyDetail, IPropertyMember, IUser } from "@/packages/shared";
import { PropertyRole, UserType } from "@/packages/shared";

export interface IPropertyPermissions {
  callerMembership?: IPropertyMember;
  canManageLedger: boolean;
  canManageMembers: boolean;
  canManageStructure: boolean;
  canManageUnits: boolean;
  canView: boolean;
  isAdmin: boolean;
  isCreator: boolean;
}

export function derivePropertyPermissions(
  property: IPropertyDetail | undefined,
  currentUser: IUser | null | undefined
): IPropertyPermissions {
  const isAdmin = currentUser?.userType === UserType.ADMIN;
  const isCreator = Boolean(property && currentUser && property.createdBy === currentUser.id);
  const callerMembership = property?.members.find((m) => m.userId === currentUser?.id);
  const isOwnerMember = callerMembership?.role === PropertyRole.OWNER;
  const isManagerMember = callerMembership?.role === PropertyRole.MANAGER;
  const canManageStructure = isAdmin || isCreator || isOwnerMember;
  const canManageUnits = isAdmin || isCreator || isOwnerMember || isManagerMember;
  const canManageLedger = isCreator || isOwnerMember;
  const canView = isAdmin || isCreator || Boolean(callerMembership);

  return {
    callerMembership,
    canManageLedger,
    canManageMembers: canManageStructure,
    canManageStructure,
    canManageUnits,
    canView,
    isAdmin,
    isCreator,
  };
}

export function usePropertyPermissions(
  property: IPropertyDetail | undefined,
  currentUser: IUser | null | undefined
): IPropertyPermissions {
  return useMemo(
    () => derivePropertyPermissions(property, currentUser),
    [currentUser, property]
  );
}
