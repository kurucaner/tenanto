import type { FastifyReply } from "fastify";

import { propertiesDb } from "@/db/properties";
import { propertyMembersDb } from "@/db/property-members";
import { HttpStatus, PropertyRole, UserType } from "@/packages/shared";

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

export async function assertPropertyLedgerWriteAccess(
  propertyId: string,
  userId: string,
  _userType: string,
  reply: FastifyReply,
  forbiddenMessage = "Only property owners can manage income and expenses"
): Promise<boolean> {
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
