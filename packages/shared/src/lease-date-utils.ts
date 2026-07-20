import { type IPropertyLongStay, PropertyLongStayStatus } from "./property-long-stay-types";

function formatLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const parts = isoDate.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatLocalIsoDate(date);
}

export function addMonthsToIsoDate(isoDate: string, months: number): string {
  const parts = isoDate.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(year, month - 1 + months, day);
  return formatLocalIsoDate(date);
}

export function calculateLeaseEndDate(leaseStartDate: string, termMonths: number): string {
  return addDaysToIsoDate(addMonthsToIsoDate(leaseStartDate, termMonths), -1);
}

export function enumerateLeaseMonths(leaseStartDate: string, leaseEndDate: string): string[] {
  const startParts = leaseStartDate.split("-").map(Number);
  const endParts = leaseEndDate.split("-").map(Number);
  let year = startParts[0] ?? 0;
  let month = startParts[1] ?? 1;
  const endYear = endParts[0] ?? 0;
  const endMonth = endParts[1] ?? 1;
  const months: string[] = [];

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

export function formatLeaseMonthLabel(month: string): string {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthNum = parts[1] ?? 1;
  return new Date(year, monthNum - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function transactionDateToMonth(transactionDate: string): string {
  return transactionDate.slice(0, 7);
}

export function getEndLeaseMoveOutDateBounds(
  leaseStartDate: string,
  leaseEndDate: string,
  today: string
): { defaultDate: string; maxDate: string; minDate: string } {
  const maxDate = today;
  const minDate = today > leaseEndDate ? leaseEndDate : leaseStartDate;

  return { defaultDate: today, maxDate, minDate };
}

export function validateEndLeaseMoveOutDate(
  actualEndDate: string,
  leaseStartDate: string,
  leaseEndDate: string,
  today: string
): string | null {
  const { maxDate, minDate } = getEndLeaseMoveOutDateBounds(leaseStartDate, leaseEndDate, today);

  if (actualEndDate > maxDate) {
    return "Move-out date cannot be in the future";
  }

  if (actualEndDate < minDate) {
    if (today > leaseEndDate) {
      return "Move-out date cannot be before the lease end date";
    }

    return "Move-out date cannot be before the lease start date";
  }

  return null;
}

export function isActiveLeaseInHoldover(
  lease: Pick<IPropertyLongStay, "leaseEndDate" | "status">,
  today: string
): boolean {
  return lease.status === PropertyLongStayStatus.ACTIVE && today > lease.leaseEndDate;
}
