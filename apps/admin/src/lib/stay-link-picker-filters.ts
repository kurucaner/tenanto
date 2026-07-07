import type { IPropertyReservationsListQuery } from "@/packages/shared";

export const RECENT_STAY_PICKER_DAYS = 90;
export const STAY_PICKER_DATE_WINDOW_DAYS = 14;
export const STAY_PICKER_LIMIT = 50;

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

export function daysAgoIsoDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return formatIsoDate(date);
}

export function buildStayLinkPickerFilters(input: {
  forAmenityUnit?: boolean;
  includeReservationId?: string;
  transactionDate?: string;
  unitId: string;
}): IPropertyReservationsListQuery {
  const filters: IPropertyReservationsListQuery = {
    limit: STAY_PICKER_LIMIT,
  };

  if (!input.forAmenityUnit && input.unitId) {
    filters.unitId = input.unitId;
  }

  if (input.includeReservationId) {
    filters.includeReservationId = input.includeReservationId;
  }

  if (input.transactionDate) {
    filters.checkInTo = addDaysToIsoDate(input.transactionDate, STAY_PICKER_DATE_WINDOW_DAYS);
    filters.checkOutFrom = addDaysToIsoDate(input.transactionDate, -STAY_PICKER_DATE_WINDOW_DAYS);
  } else {
    filters.checkOutFrom = daysAgoIsoDate(RECENT_STAY_PICKER_DAYS);
  }

  return filters;
}
