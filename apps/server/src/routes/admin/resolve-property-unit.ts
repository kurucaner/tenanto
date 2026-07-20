import type { FastifyReply } from "fastify";

import { propertyUnitsDb } from "@/db/property-units";
import { HttpStatus, type IPropertyUnit, type TUnitRentalType } from "@/packages/shared";

export async function resolvePropertyUnit(
  unitId: string,
  propertyId: string,
  reply: FastifyReply,
  options?: {
    rentalType?: TUnitRentalType;
    rentalTypeError?: string;
    requireNotDeleted?: boolean;
  }
): Promise<IPropertyUnit | null> {
  const unit = await propertyUnitsDb.findById(unitId);
  if (!unit || unit.propertyId !== propertyId) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Unit not found for this property" });
    return null;
  }
  if (options?.rentalType != null && unit.rentalType !== options.rentalType) {
    void reply.status(HttpStatus.BAD_REQUEST).send({
      error: options.rentalTypeError ?? "Unit rental type is not valid for this operation",
    });
    return null;
  }
  if (options?.requireNotDeleted !== false && unit.isDeleted) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Unit has been deleted" });
    return null;
  }
  return unit;
}
