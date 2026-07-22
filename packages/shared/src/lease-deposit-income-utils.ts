import {
  type IPropertyIncomeLineType,
  isSystemSecurityDepositIncomeLineTypeName,
  SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
} from "./property-income-line-type-config";

export function isDepositIncomeLineType(type: Pick<IPropertyIncomeLineType, "name">): boolean {
  return isSystemSecurityDepositIncomeLineTypeName(type.name);
}

/** True when the line’s type name is known and matches Security deposit. */
export function isDepositIncomeLine(line: { incomeLineTypeName?: string | null }): boolean {
  const name = line.incomeLineTypeName?.trim();
  if (name == null || name === "") {
    return false;
  }
  return isDepositIncomeLineType({ name });
}

/** Drops Security deposit rows from report “other income” breakdowns. */
export function excludeDepositOtherIncomeRows<T extends { name: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isDepositIncomeLineType(row));
}

export function filterOutDepositIncomeLines<T extends { incomeLineTypeName?: string | null }>(
  lines: readonly T[]
): T[] {
  return lines.filter((line) => !isDepositIncomeLine(line));
}

/** SQL predicate: income line type is the system Security deposit type (`ilt` alias required). */
export function sqlIsSecurityDepositIncomeLineType(typeNameColumn = "ilt.name"): string {
  return `lower(${typeNameColumn}) = lower('${SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME}')`;
}
