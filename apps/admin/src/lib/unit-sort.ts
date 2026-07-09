import { compareNumbers, compareStrings, type ISortState, sortRows } from "@/lib/table-sort";
import { type IPropertyUnit, type TUnitRentalType, UnitRentalType } from "@/packages/shared";

export type TUnitSortColumnId = "type";

function getRentalTypeOrder(type: TUnitRentalType): number {
  return type === UnitRentalType.SHORT_TERM ? 0 : 1;
}

export function sortUnits(units: IPropertyUnit[], sortState: ISortState): IPropertyUnit[] {
  const columnId = sortState.columnId as TUnitSortColumnId;

  return sortRows(units, sortState, (a, b) => {
    if (columnId === "type") {
      const typeDiff = compareNumbers(
        getRentalTypeOrder(a.rentalType),
        getRentalTypeOrder(b.rentalType)
      );
      if (typeDiff !== 0) {
        return typeDiff;
      }
    }

    return compareStrings(a.unitNumber, b.unitNumber);
  });
}
