import { PropertyLongStayStatus } from "@/packages/shared";

import { testDateTime } from "../dates";
import { sequentialUnitId, TEST_PROPERTY_ID } from "../ids";

export type TLongStayRowOverrides = Record<string, unknown>;

export function buildLongStayRow(overrides: TLongStayRowOverrides = {}): Record<string, unknown> {
  return {
    actual_end_date: null,
    created_at: testDateTime(0),
    guest_name: "Tenant A",
    id: "11111111-1111-4111-8111-111111111111",
    lease_end_date: "2027-07-09",
    lease_start_date: "2026-07-09",
    property_id: TEST_PROPERTY_ID,
    rent_amount: "1500.00",
    secondary_tenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenant_email: null,
    tenant_phone: null,
    term_months: 12,
    unit_id: sequentialUnitId(1),
    updated_at: testDateTime(0),
    ...overrides,
  };
}
