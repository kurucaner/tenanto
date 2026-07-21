import { describe, expect, test } from "bun:test";

const { mapPropertyIncomeLineRow } = await import("./mappers");

describe("mapPropertyIncomeLineRow", () => {
  test("maps tenant_rent_payment_id to tenantRentPaymentId", () => {
    const row = {
      amount: "200.00",
      channel_commission: "0",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      deleted_at: null,
      description: "Tenant rent payment (2026-01)",
      gross_income: "200.00",
      guest_name: null,
      id: "line-1",
      income_line_type_id: "type-rent",
      is_deleted: false,
      long_stay_id: "lease-1",
      net_income: "200.00",
      property_id: "property-1",
      refunded_amount: null,
      refunded_at: null,
      refunded_by: null,
      rent_period_key: "2026-01",
      reservation_id: null,
      tax_breakdown: [],
      tenant_rent_payment_id: "payment-1",
      transaction_date: "2026-01-01",
      unit_id: "unit-1",
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    };

    expect(mapPropertyIncomeLineRow(row)).toMatchObject({
      id: "line-1",
      rentPeriodKey: "2026-01",
      tenantRentPaymentId: "payment-1",
    });
  });

  test("defaults tenantRentPaymentId to null when column is absent", () => {
    const row = {
      amount: "100.00",
      channel_commission: "0",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      deleted_at: null,
      description: null,
      gross_income: "100.00",
      guest_name: null,
      id: "line-2",
      income_line_type_id: "type-fee",
      is_deleted: false,
      long_stay_id: null,
      net_income: "100.00",
      property_id: "property-1",
      refunded_amount: null,
      refunded_at: null,
      refunded_by: null,
      rent_period_key: null,
      reservation_id: null,
      tax_breakdown: [],
      transaction_date: "2026-01-15",
      unit_id: "unit-1",
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    };

    expect(mapPropertyIncomeLineRow(row).tenantRentPaymentId).toBeNull();
  });
});
