import { PropertyLongStayStatus } from "@/packages/shared";

import { testDateTime } from "../dates";
import { buildLongStayRow } from "../db-rows/long-stay-row";
import { labelFromIndex, sequentialUnitId, sequentialUuid } from "../ids";

const LONG_STAY_PAGE_SPECS = [
  {
    actualEndDate: null,
    createdAt: testDateTime(0),
    leaseEndDate: "2027-07-09",
    leaseStartDate: "2026-07-09",
    rentAmount: "1500.00",
    status: PropertyLongStayStatus.ACTIVE,
    termMonths: 12,
    unitIndex: 1,
    updatedAt: testDateTime(0),
  },
  {
    actualEndDate: "2026-06-30",
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    leaseEndDate: "2026-06-30",
    leaseStartDate: "2026-01-01",
    rentAmount: "1200.00",
    status: PropertyLongStayStatus.ENDED,
    termMonths: 6,
    unitIndex: 2,
    updatedAt: new Date("2026-06-30T10:00:00.000Z"),
  },
  {
    actualEndDate: null,
    createdAt: new Date("2025-12-01T10:00:00.000Z"),
    leaseEndDate: "2026-05-31",
    leaseStartDate: "2025-12-01",
    rentAmount: "1100.00",
    status: PropertyLongStayStatus.ENDED,
    termMonths: 6,
    unitIndex: 3,
    updatedAt: new Date("2026-05-31T10:00:00.000Z"),
  },
] as const;

export function buildDescendingLongStayRows(): Record<string, unknown>[] {
  return LONG_STAY_PAGE_SPECS.map((spec, rowIndex) =>
    buildLongStayRow({
      actual_end_date: spec.actualEndDate,
      created_at: spec.createdAt,
      guest_name: `Tenant ${labelFromIndex(rowIndex)}`,
      id: sequentialUuid(rowIndex + 1),
      lease_end_date: spec.leaseEndDate,
      lease_start_date: spec.leaseStartDate,
      rent_amount: spec.rentAmount,
      status: spec.status,
      term_months: spec.termMonths,
      unit_id: sequentialUnitId(spec.unitIndex),
      updated_at: spec.updatedAt,
    })
  );
}

export const LONG_STAY_PAGINATION_COUNT_ROW = {
  active_count: 1,
  ended_count: 2,
  total_count: 3,
};
