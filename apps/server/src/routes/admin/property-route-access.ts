import type { FastifyReply } from "fastify";

import { propertiesDb } from "@/db/properties";
import { propertyMembersDb } from "@/db/property-members";
import { HttpStatus, PropertyRole, UserType } from "@/packages/shared";

const UNIT_MANAGE_ROLES = new Set<string>([PropertyRole.OWNER, PropertyRole.MANAGER]);
const LEDGER_WRITE_ROLES = new Set<string>([PropertyRole.OWNER, PropertyRole.MANAGER]);

export async function assertPropertyMemberAccess(
  propertyId: string,
  userId: string,
  userType: string,
  reply: FastifyReply
): Promise<boolean> {
  const property = await propertiesDb.findById(propertyId);
  if (!property) {
    void reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
    return false;
  }
  if (userType === UserType.ADMIN) return true;

  const isCreator = property.createdBy === userId;
  if (!isCreator) {
    const membership = await propertyMembersDb.findOne(propertyId, userId);
    if (!membership) {
      void reply.status(HttpStatus.FORBIDDEN).send({ error: "Access denied" });
      return false;
    }
  }
  return true;
}

export async function assertPropertyStructureAccess(
  propertyId: string,
  userId: string,
  userType: string,
  reply: FastifyReply,
  forbiddenMessage = "Only property owners can manage property structure"
): Promise<boolean> {
  if (userType === UserType.ADMIN) return true;
  const property = await propertiesDb.findById(propertyId);
  if (!property) {
    void reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
    return false;
  }
  if (property.createdBy === userId) return true;
  const membership = await propertyMembersDb.findOne(propertyId, userId);
  if (membership?.role !== PropertyRole.OWNER) {
    void reply.status(HttpStatus.FORBIDDEN).send({ error: forbiddenMessage });
    return false;
  }
  return true;
}

export async function assertPropertyUnitManageAccess(
  propertyId: string,
  userId: string,
  userType: string,
  reply: FastifyReply,
  forbiddenMessage = "Only property owners and managers can manage units"
): Promise<boolean> {
  if (userType === UserType.ADMIN) return true;
  const property = await propertiesDb.findById(propertyId);
  if (!property) {
    void reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
    return false;
  }
  if (property.createdBy === userId) return true;
  const membership = await propertyMembersDb.findOne(propertyId, userId);
  if (!membership || !UNIT_MANAGE_ROLES.has(membership.role)) {
    void reply.status(HttpStatus.FORBIDDEN).send({ error: forbiddenMessage });
    return false;
  }
  return true;
}

export async function assertPropertyLedgerWriteAccess(
  propertyId: string,
  userId: string,
  userType: string,
  reply: FastifyReply,
  forbiddenMessage = "Only property owners and managers can manage income and expenses"
): Promise<boolean> {
  if (userType === UserType.ADMIN) return true;
  const property = await propertiesDb.findById(propertyId);
  if (!property) {
    void reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
    return false;
  }
  if (property.createdBy === userId) return true;
  const membership = await propertyMembersDb.findOne(propertyId, userId);
  if (!membership || !LEDGER_WRITE_ROLES.has(membership.role)) {
    void reply.status(HttpStatus.FORBIDDEN).send({ error: forbiddenMessage });
    return false;
  }
  return true;
}

export async function assertPropertyTenantNotificationAccess(
  propertyId: string,
  userId: string,
  userType: string,
  reply: FastifyReply,
  forbiddenMessage = "Only property owners can send tenant notifications"
): Promise<boolean> {
  return assertPropertyStructureAccess(propertyId, userId, userType, reply, forbiddenMessage);
}
