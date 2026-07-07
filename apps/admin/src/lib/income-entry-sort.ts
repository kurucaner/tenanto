import { formatChannelLabel, formatStatusLabel } from "@/components/income/reservation-form-options";
import {
  compareDates,
  compareNumbers,
  compareStrings,
  type ISortState,
  sortRows,
} from "@/lib/table-sort";
import {
  getStayTaxesAndFeesTotal,
  IncomeEntryKind,
  type TPropertyIncomeEntry,
} from "@/packages/shared";

export type TIncomeEntrySortColumnId =
  | "type"
  | "unit"
  | "guest"
  | "date"
  | "checkOut"
  | "nights"
  | "channel"
  | "status"
  | "roomRate"
  | "cleaning"
  | "taxesFees"
  | "gross"
  | "net";

function getEntryDate(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY
    ? entry.stay.checkIn
    : entry.line.transactionDate;
}

function getEntryTypeLabel(entry: TPropertyIncomeEntry): string {
  if (entry.entryKind === IncomeEntryKind.STAY) {
    return "Stay";
  }

  return entry.line.incomeLineTypeName ?? entry.line.incomeLineTypeId;
}

function getEntryUnitId(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY ? entry.stay.unitId : entry.line.unitId;
}

function getIncomeEntrySortValue(
  entry: TPropertyIncomeEntry,
  columnId: TIncomeEntrySortColumnId,
  unitLabelById: Map<string, string>
): string | number {
  if (entry.entryKind === IncomeEntryKind.STAY) {
    const { stay } = entry;
    switch (columnId) {
      case "type":
        return getEntryTypeLabel(entry);
      case "unit":
        return unitLabelById.get(stay.unitId) ?? "";
      case "guest":
        return stay.guestName;
      case "date":
        return stay.checkIn;
      case "checkOut":
        return stay.checkOut;
      case "nights":
        return stay.nights;
      case "channel":
        return formatChannelLabel(stay.channel);
      case "status":
        return formatStatusLabel(stay.status);
      case "roomRate":
        return stay.roomRate;
      case "cleaning":
        return stay.cleaningFee;
      case "taxesFees":
        return getStayTaxesAndFeesTotal(stay);
      case "gross":
        return stay.grossIncome;
      case "net":
        return stay.netIncome;
    }
  }

  const { line } = entry;
  switch (columnId) {
    case "type":
      return getEntryTypeLabel(entry);
    case "unit":
      return unitLabelById.get(line.unitId) ?? "";
    case "guest":
      return line.guestName ?? "";
    case "date":
      return line.transactionDate;
    case "checkOut":
      return "";
    case "nights":
      return 0;
    case "channel":
      return "";
    case "status":
      return "";
    case "roomRate":
      return line.amount;
    case "cleaning":
      return 0;
    case "taxesFees":
      return 0;
    case "gross":
      return line.grossIncome;
    case "net":
      return line.netIncome;
  }
}

function compareIncomeEntryValues(
  a: string | number,
  b: string | number,
  columnId: TIncomeEntrySortColumnId
): number {
  if (typeof a === "number" && typeof b === "number") {
    return compareNumbers(a, b);
  }

  if (columnId === "date" || columnId === "checkOut") {
    return compareDates(String(a), String(b));
  }

  return compareStrings(String(a), String(b));
}

export function sortIncomeEntries(
  entries: TPropertyIncomeEntry[],
  sortState: ISortState,
  unitLabelById: Map<string, string>
): TPropertyIncomeEntry[] {
  const columnId = sortState.columnId as TIncomeEntrySortColumnId;

  return sortRows(entries, sortState, (a, b) => {
    const valueA = getIncomeEntrySortValue(a, columnId, unitLabelById);
    const valueB = getIncomeEntrySortValue(b, columnId, unitLabelById);
    return compareIncomeEntryValues(valueA, valueB, columnId);
  });
}

export { getEntryDate, getEntryUnitId };
