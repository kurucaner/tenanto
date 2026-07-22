export const FAVORITE_OLD_ID = "11111111-1111-4111-8111-111111111111";
export const FAVORITE_NEW_ID = "22222222-2222-4222-8222-222222222222";
export const UNFAVORITE_NEW_ID = "33333333-3333-4333-8333-333333333333";
export const UNFAVORITE_OLD_ID = "44444444-4444-4444-8444-444444444444";

export type TPropertyRowOverrides = Record<string, unknown>;

export interface IPropertyRowInput {
  createdAt: string;
  favoritedAt: Date | null;
  id: string;
  name: string;
  userId?: string;
}

export function buildPropertyRow(
  input: IPropertyRowInput,
  overrides: TPropertyRowOverrides = {}
): Record<string, unknown> {
  return {
    address: "123 Main St",
    created_at: new Date(input.createdAt),
    created_by: input.userId ?? "22222222-2222-4222-8222-222222222222",
    favorited_at: input.favoritedAt,
    id: input.id,
    legal_name: null,
    member_count: 1,
    name: input.name,
    phone_number: null,
    unit_count: 0,
    updated_at: new Date(input.createdAt),
    ...overrides,
  };
}

export function buildRentScheduleIncomeLineRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    amount: "1500.00",
    channel_commission: "0.00",
    created_at: new Date("2026-01-15T12:00:00.000Z"),
    deleted_at: null,
    description: null,
    gross_income: "1500.00",
    guest_name: null,
    id: "line-rent-jan",
    income_line_type_id: "00000000-0000-4000-8000-000000000031",
    income_line_type_name: "Rent",
    is_deleted: false,
    long_stay_id: "lease-1",
    net_income: "1500.00",
    property_id: "prop-1",
    refunded_amount: null,
    refunded_at: null,
    refunded_by: null,
    rent_period_key: null,
    reservation_id: null,
    tax_breakdown: "[]",
    tenant_rent_payment_id: null,
    transaction_date: "2026-01-15",
    unit_id: "unit-1",
    updated_at: new Date("2026-01-15T12:00:00.000Z"),
    ...overrides,
  };
}

export function buildRentScheduleLeaseRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    actual_end_date: null,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    guest_name: "Tenant",
    id: "lease-1",
    lease_end_date: "2026-03-31",
    lease_start_date: "2026-01-01",
    property_id: "prop-1",
    rent_amount: "1500.00",
    rent_billing_cadence: "monthly",
    secondary_tenants: [],
    security_deposit_amount: null,
    status: "active",
    tenant_email: null,
    tenant_phone: null,
    term_months: 3,
    unit_id: "unit-1",
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
