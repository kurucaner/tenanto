import { describe, expect, test } from "bun:test";

import { derivePropertyPermissions } from "@/hooks/use-property-permissions";
import type { IPropertyDetail, IPropertyMember, IUser } from "@/packages/shared";
import { PropertyRole, UserType } from "@/packages/shared";

const propertyId = "property-1";
const creatorId = "creator-1";
const ownerId = "owner-1";
const managerId = "manager-1";
const accountantId = "accountant-1";
const adminId = "admin-1";

function makeUser(id: string, userType: UserType): IUser {
  return {
    appleId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    email: `${id}@example.com`,
    googleId: null,
    id,
    name: id,
    onboardingCompletedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userType,
  };
}

function makeMember(userId: string, role: IPropertyMember["role"]): IPropertyMember {
  return {
    addedBy: creatorId,
    createdAt: "2026-01-01T00:00:00.000Z",
    id: `${userId}-membership`,
    propertyId,
    role,
    updatedAt: "2026-01-01T00:00:00.000Z",
    user: {
      email: `${userId}@example.com`,
      id: userId,
      name: userId,
    },
    userId,
  };
}

function makeProperty(members: IPropertyMember[]): IPropertyDetail {
  return {
    address: "123 Main St",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: creatorId,
    creator: {
      email: "creator@example.com",
      id: creatorId,
      name: "Creator",
    },
    favoritedAt: null,
    id: propertyId,
    invites: [],
    isFavorite: false,
    legalName: null,
    memberCount: members.length,
    members,
    name: "Test Property",
    phoneNumber: null,
    unitCount: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("derivePropertyPermissions", () => {
  test("manager member can manage units and ledger but not structure", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([makeMember(managerId, PropertyRole.MANAGER)]),
      makeUser(managerId, UserType.USER)
    );

    expect(permissions.canManageUnits).toBe(true);
    expect(permissions.canManageStructure).toBe(false);
    expect(permissions.canManageLedger).toBe(true);
    expect(permissions.canView).toBe(true);
  });

  test("owner member can manage units and structure", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([makeMember(ownerId, PropertyRole.OWNER)]),
      makeUser(ownerId, UserType.USER)
    );

    expect(permissions.canManageUnits).toBe(true);
    expect(permissions.canManageStructure).toBe(true);
    expect(permissions.canManageLedger).toBe(true);
  });

  test("accountant member cannot manage units or structure", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([makeMember(accountantId, PropertyRole.ACCOUNTANT)]),
      makeUser(accountantId, UserType.USER)
    );

    expect(permissions.canManageUnits).toBe(false);
    expect(permissions.canManageStructure).toBe(false);
    expect(permissions.canManageLedger).toBe(false);
    expect(permissions.canView).toBe(true);
  });

  test("creator can manage units and structure", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([]),
      makeUser(creatorId, UserType.USER)
    );

    expect(permissions.canManageUnits).toBe(true);
    expect(permissions.canManageStructure).toBe(true);
    expect(permissions.canManageLedger).toBe(true);
  });

  test("platform admin can manage units and structure", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([]),
      makeUser(adminId, UserType.ADMIN)
    );

    expect(permissions.canManageUnits).toBe(true);
    expect(permissions.canManageStructure).toBe(true);
    expect(permissions.canManageLedger).toBe(true);
    expect(permissions.canView).toBe(true);
    expect(permissions.canSendTenantNotifications).toBe(true);
  });

  test("manager cannot send tenant notifications or manage Stripe Connect", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([makeMember(managerId, PropertyRole.MANAGER)]),
      makeUser(managerId, UserType.USER)
    );

    expect(permissions.canSendTenantNotifications).toBe(false);
    expect(permissions.canManageStripeConnect).toBe(false);
  });

  test("accountant cannot manage Stripe Connect", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([makeMember(accountantId, PropertyRole.ACCOUNTANT)]),
      makeUser(accountantId, UserType.USER)
    );

    expect(permissions.canManageStripeConnect).toBe(false);
  });

  test("creator without owner membership cannot manage Stripe Connect", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([]),
      makeUser(creatorId, UserType.USER)
    );

    expect(permissions.canManageStructure).toBe(true);
    expect(permissions.canManageStripeConnect).toBe(false);
  });

  test("owner can send tenant notifications and manage Stripe Connect", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([makeMember(ownerId, PropertyRole.OWNER)]),
      makeUser(ownerId, UserType.USER)
    );

    expect(permissions.canSendTenantNotifications).toBe(true);
    expect(permissions.canManageStripeConnect).toBe(true);
  });

  test("platform admin can manage Stripe Connect", () => {
    const permissions = derivePropertyPermissions(
      makeProperty([]),
      makeUser(adminId, UserType.ADMIN)
    );

    expect(permissions.canManageStripeConnect).toBe(true);
  });
});
