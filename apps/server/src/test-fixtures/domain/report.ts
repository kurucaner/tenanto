import { type IReportData } from "@/services/property-report-service";

import { makeUnit } from "./property";

export function makeReportData(overrides: Partial<IReportData> = {}): IReportData {
  return {
    expenses: [],
    incomeLines: [],
    reservations: [],
    units: [makeUnit()],
    ...overrides,
  };
}
