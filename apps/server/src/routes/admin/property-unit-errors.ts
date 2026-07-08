import type { IUnitDeleteBlockers } from "@/db/property-units";

export const UNIT_DELETE_FOREIGN_KEY_FALLBACK =
  "This unit cannot be deleted because it is linked to reservations, income, or long stay records";

export function duplicateUnitNumberMessage(): string {
  return "A unit with this number already exists on this property";
}

export function formatUnitDeleteBlockedMessage(blockers: IUnitDeleteBlockers): string {
  const { incomeLineCount, longStayCount, reservationCount } = blockers;
  const blockedTypes: string[] = [];
  if (reservationCount > 0) blockedTypes.push("reservation");
  if (incomeLineCount > 0) blockedTypes.push("income");
  if (longStayCount > 0) blockedTypes.push("long stay");

  if (blockedTypes.length > 1) {
    return `This unit cannot be deleted because it has ${blockedTypes.join(" and ")} records`;
  }
  if (reservationCount > 0) {
    const label = reservationCount === 1 ? "record" : "records";
    return `This unit cannot be deleted because it has ${reservationCount} reservation ${label}`;
  }
  if (incomeLineCount > 0) {
    const label = incomeLineCount === 1 ? "record" : "records";
    return `This unit cannot be deleted because it has ${incomeLineCount} income ${label}`;
  }
  if (longStayCount > 0) {
    const label = longStayCount === 1 ? "record" : "records";
    return `This unit cannot be deleted because it has ${longStayCount} long stay ${label}`;
  }
  return UNIT_DELETE_FOREIGN_KEY_FALLBACK;
}

export function getUnitDeleteBlockerCode(blockers: IUnitDeleteBlockers): string | undefined {
  const { incomeLineCount, longStayCount, reservationCount } = blockers;
  const blockedTypeCount = [reservationCount > 0, incomeLineCount > 0, longStayCount > 0].filter(
    Boolean
  ).length;
  if (blockedTypeCount > 1) return "UNIT_IN_USE";
  if (reservationCount > 0) return "UNIT_HAS_RESERVATIONS";
  if (incomeLineCount > 0) return "UNIT_HAS_INCOME";
  if (longStayCount > 0) return "UNIT_HAS_LONG_STAYS";
  return undefined;
}
