import { propertyIncomeLineTypesDb } from "@/db/property-income-line-types";
import { type IPropertyIncomeLineType } from "@/packages/shared";

/**
 * System income type for lease-linked creates.
 * Deposit intent → Security deposit; otherwise Long-term rent (including Stripe rent).
 */
export async function resolveLeaseIncomeLineSystemType(
  propertyId: string,
  isSecurityDeposit: boolean | undefined
): Promise<IPropertyIncomeLineType> {
  if (isSecurityDeposit) {
    return propertyIncomeLineTypesDb.ensureLeaseDepositIncomeLineType(propertyId);
  }
  return propertyIncomeLineTypesDb.ensureLeaseRentIncomeLineType(propertyId);
}
