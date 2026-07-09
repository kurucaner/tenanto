import {
  formatChannelLabel,
  formatStatusLabel,
} from "@/components/income/reservation-form-options";
import {
  compareDates,
  compareNumbers,
  compareStrings,
  type ISortState,
  sortRows,
} from "@/lib/table-sort";
import {
  getStayNetPayout,
  getStayTaxesTotal,
  IncomeEntryKind,
  PROPERTY_AMENITY_UNIT_LABEL,
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
  | "roomTotal"
  | "cleaning"
  | "taxes"
  | "commission"
  | "gross"
  | "netPayout"
  | "net";

function getEntryDate(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY ? entry.stay.checkIn : entry.line.transactionDate;
}

function getEntryTypeLabel(entry: TPropertyIncomeEntry): string {
  if (entry.entryKind === IncomeEntryKind.STAY) {
    return "Stay";
  }

  return entry.line.incomeLineTypeName ?? entry.line.incomeLineTypeId;
}

function getEntryUnitId(entry: TPropertyIncomeEntry): string | null {
  return entry.entryKind === IncomeEntryKind.STAY ? entry.stay.unitId : entry.line.unitId;
}

// Resolves the Unit column label; a null unit means property-amenity income.
function resolveIncomeUnitLabel(
  unitId: string | null,
  unitLabelById: Map<string, string>
): string {
  if (unitId === null) return PROPERTY_AMENITY_UNIT_LABEL;
  return unitLabelById.get(unitId) ?? "—";
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
      case "roomTotal":
        return stay.roomTotal;
      case "cleaning":
        return stay.cleaningFee;
      case "taxes":
        return getStayTaxesTotal(stay);
      case "commission":
        return stay.channelCommission;
      case "gross":
        return stay.grossIncome;
      case "netPayout":
        return getStayNetPayout(stay);
      case "net":
        return stay.netIncome;
    }
  }

  const { line } = entry;
  switch (columnId) {
    case "type":
      return getEntryTypeLabel(entry);
    case "unit":
      return resolveIncomeUnitLabel(line.unitId, unitLabelById);
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
    case "roomTotal":
      return line.amount;
    case "cleaning":
      return 0;
    case "taxes":
      return 0;
    case "commission":
      return 0;
    case "gross":
      return line.grossIncome;
    case "netPayout":
      return line.netIncome;
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

export { getEntryDate, getEntryUnitId, resolveIncomeUnitLabel };
