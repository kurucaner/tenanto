import {
  type IPropertyIncomeLineType,
  isSystemSecurityDepositIncomeLineTypeName,
} from "./property-income-line-type-config";

export function isDepositIncomeLineType(type: Pick<IPropertyIncomeLineType, "name">): boolean {
  return isSystemSecurityDepositIncomeLineTypeName(type.name);
}
