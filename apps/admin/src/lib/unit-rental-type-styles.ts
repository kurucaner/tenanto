import {
  formatUnitRentalTypeLabel,
  type TUnitRentalType,
  UnitRentalType,
} from "@/packages/shared";

export interface IUnitRentalTypeOption {
  hint: string;
  label: string;
  value: TUnitRentalType;
}

export const UNIT_RENTAL_TYPE_OPTIONS: readonly IUnitRentalTypeOption[] = [
  {
    hint: "Track nightly reservations and channel commissions.",
    label: formatUnitRentalTypeLabel(UnitRentalType.SHORT_TERM),
    value: UnitRentalType.SHORT_TERM,
  },
  {
    hint: "Track leases, vacancy, and monthly occupancy.",
    label: formatUnitRentalTypeLabel(UnitRentalType.LONG_TERM),
    value: UnitRentalType.LONG_TERM,
  },
];

export function getUnitRentalTypeBadgeClassName(type: TUnitRentalType): string {
  return type === UnitRentalType.SHORT_TERM
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
}

export function getUnitRentalTypePickerSelectedClassName(type: TUnitRentalType): string {
  return type === UnitRentalType.SHORT_TERM
    ? "border-blue-600 bg-blue-100 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-400"
    : "border-amber-600 bg-amber-100 text-amber-700 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-400";
}

export function getUnitRentalTypeHint(type: TUnitRentalType): string {
  const option = UNIT_RENTAL_TYPE_OPTIONS.find((item) => item.value === type);
  return option?.hint ?? "";
}
