import { mock } from "bun:test";

import type {
  ILeaseTenantMembership,
  IProperty,
  IPropertyLongStay,
  IPropertyUnit,
  ITenantUser,
  TTenantMembershipStatus,
} from "@/packages/shared";

import {
  mockAsyncFn,
  mockResolvedEmpty,
  mockResolvedNull,
} from "./async-mocks";

export interface ITenantPortalDbMocks {
  endAllNonTerminalForLease: ReturnType<typeof mockResolvedEmpty<ILeaseTenantMembership>>;
  expireMembershipIfPastTtl: ReturnType<typeof mockResolvedNull<ILeaseTenantMembership>>;
  findActiveByTenantUserId: ReturnType<typeof mockResolvedEmpty<ILeaseTenantMembership>>;
  findByIdLease: ReturnType<typeof mockResolvedNull<IPropertyLongStay>>;
  findByIdMembership: ReturnType<typeof mockResolvedNull<ILeaseTenantMembership>>;
  findByIdProperty: ReturnType<typeof mockResolvedNull<IProperty>>;
  findByIdUnit: ReturnType<typeof mockResolvedNull<IPropertyUnit>>;
  findByTokenHash: ReturnType<typeof mockResolvedNull<ILeaseTenantMembership>>;
  findEndedByTenantUserId: ReturnType<typeof mockResolvedEmpty<ILeaseTenantMembership>>;
  findPendingAcceptanceByTenantUserId: ReturnType<typeof mockResolvedEmpty<ILeaseTenantMembership>>;
  findTenantById: ReturnType<typeof mockResolvedNull<ITenantUser>>;
  linkTenantUser: ReturnType<
    typeof mockAsyncFn<
      [string, string],
      ILeaseTenantMembership | null
    >
  >;
  setUnverifiedPhoneIfNull: ReturnType<typeof mockResolvedNull<ITenantUser>>;
  transitionStatus: ReturnType<
    typeof mockAsyncFn<
      [string, TTenantMembershipStatus],
      ILeaseTenantMembership | null
    >
  >;
}

export function createTenantPortalDbMocks(): ITenantPortalDbMocks {
  return {
    endAllNonTerminalForLease: mockResolvedEmpty<ILeaseTenantMembership>(),
    expireMembershipIfPastTtl: mockResolvedNull<ILeaseTenantMembership>(),
    findActiveByTenantUserId: mockResolvedEmpty<ILeaseTenantMembership>(),
    findByIdLease: mockResolvedNull<IPropertyLongStay>(),
    findByIdMembership: mockResolvedNull<ILeaseTenantMembership>(),
    findByIdProperty: mockResolvedNull<IProperty>(),
    findByIdUnit: mockResolvedNull<IPropertyUnit>(),
    findByTokenHash: mockResolvedNull<ILeaseTenantMembership>(),
    findEndedByTenantUserId: mockResolvedEmpty<ILeaseTenantMembership>(),
    findPendingAcceptanceByTenantUserId: mockResolvedEmpty<ILeaseTenantMembership>(),
    findTenantById: mockResolvedNull<ITenantUser>(),
    linkTenantUser: mockAsyncFn(
      async (_id: string, _tenantUserId: string): Promise<ILeaseTenantMembership | null> =>
        Promise.resolve(null)
    ),
    setUnverifiedPhoneIfNull: mockResolvedNull<ITenantUser>(),
    transitionStatus: mockAsyncFn(
      async (
        _id: string,
        _toStatus: TTenantMembershipStatus
      ): Promise<ILeaseTenantMembership | null> => Promise.resolve(null)
    ),
  };
}

export function registerTenantPortalDbModules(mocks: ITenantPortalDbMocks): void {
  mock.module("@/db/lease-tenant-memberships", () => ({
    leaseTenantMembershipsDb: {
      endAllNonTerminalForLease: mocks.endAllNonTerminalForLease,
      expireMembershipIfPastTtl: mocks.expireMembershipIfPastTtl,
      findActiveByTenantUserId: mocks.findActiveByTenantUserId,
      findById: mocks.findByIdMembership,
      findByInviteToken: mocks.findByTokenHash,
      findEndedByTenantUserId: mocks.findEndedByTenantUserId,
      findPendingAcceptanceByTenantUserId: mocks.findPendingAcceptanceByTenantUserId,
      linkTenantUser: mocks.linkTenantUser,
      transitionStatus: mocks.transitionStatus,
    },
  }));

  mock.module("@/db/property-long-stays", () => ({
    propertyLongStaysDb: { findById: mocks.findByIdLease },
  }));

  mock.module("@/db/properties", () => ({
    propertiesDb: { findById: mocks.findByIdProperty },
  }));

  mock.module("@/db/property-units", () => ({
    propertyUnitsDb: { findById: mocks.findByIdUnit },
  }));

  mock.module("@/db/tenant-users", () => ({
    tenantUsersDb: {
      findById: mocks.findTenantById,
      setUnverifiedPhoneIfNull: mocks.setUnverifiedPhoneIfNull,
    },
  }));
}
