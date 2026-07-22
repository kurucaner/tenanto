import {
  type IPropertyIncomeLineType,
  isSystemSecurityDepositIncomeLineTypeName,
  SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
} from "./property-income-line-type-config";

export { SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME };

export function isDepositIncomeLineType(type: Pick<IPropertyIncomeLineType, "name">): boolean {
  return isSystemSecurityDepositIncomeLineTypeName(type.name);
}
