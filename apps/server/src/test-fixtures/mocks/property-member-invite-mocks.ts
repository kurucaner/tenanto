import { mock } from "bun:test";

import type { IProperty, IPropertyInvite, IPropertyMember, IUser } from "@/packages/shared";
import { PropertyInviteStatus } from "@/packages/shared";

import { makeInvite } from "../domain";
import {
  mockAsyncFn,
  mockResolved,
  mockResolvedEmpty,
  mockResolvedNull,
  mockResolvedVoid,
} from "./async-mocks";

export interface IPropertyMemberInviteActionMocks {
  addMember: ReturnType<typeof mockResolvedNull<IPropertyMember>>;
  expireInviteIfPastTtl: ReturnType<typeof mockResolvedNull<IPropertyInvite>>;
  findByIdInvite: ReturnType<typeof mockResolvedNull<IPropertyInvite>>;
  findByIdProperty: ReturnType<typeof mockResolvedNull<IProperty>>;
  findByInviteToken: ReturnType<typeof mockResolvedNull<IPropertyInvite>>;
  findOneMember: ReturnType<typeof mockResolvedNull<IPropertyMember>>;
  findPendingByEmail: ReturnType<typeof mockResolvedEmpty<IPropertyInvite>>;
  notifyUser: ReturnType<typeof mockResolvedVoid>;
  transitionStatus: ReturnType<typeof mockResolvedNull<IPropertyInvite>>;
}

export function createPropertyMemberInviteActionMocks(): IPropertyMemberInviteActionMocks {
  return {
    addMember: mockResolvedNull<IPropertyMember>(),
    expireInviteIfPastTtl: mockResolvedNull<IPropertyInvite>(),
    findByIdInvite: mockResolvedNull<IPropertyInvite>(),
    findByIdProperty: mockResolvedNull<IProperty>(),
    findByInviteToken: mockResolvedNull<IPropertyInvite>(),
    findOneMember: mockResolvedNull<IPropertyMember>(),
    findPendingByEmail: mockResolvedEmpty<IPropertyInvite>(),
    notifyUser: mockResolvedVoid(),
    transitionStatus: mockResolvedNull<IPropertyInvite>(),
  };
}

export function registerPropertyMemberInviteActionModules(
  mocks: IPropertyMemberInviteActionMocks
): void {
  mock.module("@/db/property-invites", () => ({
    propertyInvitesDb: {
      expireInviteIfPastTtl: mocks.expireInviteIfPastTtl,
      findById: mocks.findByIdInvite,
      findByInviteToken: mocks.findByInviteToken,
      findPendingByEmail: mocks.findPendingByEmail,
      transitionStatus: mocks.transitionStatus,
    },
  }));

  mock.module("@/db/property-members", () => ({
    propertyMembersDb: {
      add: mocks.addMember,
      findOne: mocks.findOneMember,
    },
  }));

  mock.module("@/db/properties", () => ({
    propertiesDb: {
      findById: mocks.findByIdProperty,
    },
  }));

  mock.module("@/services/user-notifications", () => ({
    notifyUser: mocks.notifyUser,
  }));
}

export interface IPropertyMemberInviteServiceMocks {
  createInvite: ReturnType<typeof mockResolved<IPropertyInvite>>;
  expireInviteIfPastTtl: ReturnType<typeof mockResolvedNull<IPropertyInvite>>;
  findByEmail: ReturnType<typeof mockResolvedNull<IUser>>;
  findById: ReturnType<typeof mockResolved<IPropertyInvite>>;
  findByIdProperty: ReturnType<typeof mockResolvedNull<IProperty>>;
  findByIdUser: ReturnType<typeof mockResolvedNull<IUser>>;
  findByInviteToken: ReturnType<typeof mockResolvedNull<IPropertyInvite>>;
  findOneMember: ReturnType<typeof mockResolvedNull<IPropertyMember>>;
  notifyUser: ReturnType<typeof mockResolvedVoid>;
  pendingInvite: IPropertyInvite;
  sendExistingEmail: ReturnType<typeof mockResolved<boolean>>;
  sendNewEmail: ReturnType<typeof mockResolved<boolean>>;
  transitionStatus: ReturnType<typeof mockAsyncFn<[], IPropertyInvite>>;
  updateInviteToken: ReturnType<typeof mockResolved<IPropertyInvite>>;
  updateStatus: ReturnType<typeof mockResolved<IPropertyInvite>>;
}

export function createPropertyMemberInviteServiceMocks(
  pendingInvite: IPropertyInvite = makeInvite({ invitedBy: "inviter-1" })
): IPropertyMemberInviteServiceMocks {
  return {
    createInvite: mockResolved(pendingInvite),
    expireInviteIfPastTtl: mockResolvedNull<IPropertyInvite>(),
    findByEmail: mockResolvedNull<IUser>(),
    findById: mockResolved(pendingInvite),
    findByIdProperty: mockResolvedNull<IProperty>(),
    findByIdUser: mockResolvedNull<IUser>(),
    findByInviteToken: mockResolvedNull<IPropertyInvite>(),
    findOneMember: mockResolvedNull<IPropertyMember>(),
    notifyUser: mockResolvedVoid(),
    pendingInvite,
    sendExistingEmail: mockResolved(true),
    sendNewEmail: mockResolved(true),
    transitionStatus: mockAsyncFn(async () => ({
      ...pendingInvite,
      status: PropertyInviteStatus.REVOKED,
    })),
    updateInviteToken: mockResolved(pendingInvite),
    updateStatus: mockResolved(pendingInvite),
  };
}

export function registerPropertyMemberInviteServiceModules(
  mocks: IPropertyMemberInviteServiceMocks
): void {
  mock.module("@/db/properties", () => ({
    propertiesDb: { findById: mocks.findByIdProperty },
  }));

  mock.module("@/db/users", () => ({
    userDb: {
      findByEmail: mocks.findByEmail,
      findById: mocks.findByIdUser,
    },
  }));

  mock.module("@/db/property-members", () => ({
    propertyMembersDb: {
      findOne: mocks.findOneMember,
    },
  }));

  mock.module("@/db/property-invites", () => ({
    propertyInvitesDb: {
      create: mocks.createInvite,
      expireInviteIfPastTtl: mocks.expireInviteIfPastTtl,
      findById: mocks.findById,
      findByInviteToken: mocks.findByInviteToken,
      transitionStatus: mocks.transitionStatus,
      updateInviteToken: mocks.updateInviteToken,
      updateStatus: mocks.updateStatus,
    },
  }));

  mock.module("@/ses/transactional-emails", () => ({
    sendPropertyMemberInviteExistingEmail: mocks.sendExistingEmail,
    sendPropertyMemberInviteNewEmail: mocks.sendNewEmail,
  }));

  mock.module("@/services/user-notifications", () => ({
    notifyUser: mocks.notifyUser,
  }));
}
