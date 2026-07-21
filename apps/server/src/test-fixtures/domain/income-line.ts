import { type IPropertyIncomeLine } from "@/packages/shared";

export function makeIncomeLine(overrides: Partial<IPropertyIncomeLine> = {}): IPropertyIncomeLine {
  return {
    amount: 75,
    channelCommission: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    description: null,
    grossIncome: 75,
    guestName: null,
    id: "line-1",
    incomeLineTypeId: "type-fee",
    incomeLineTypeName: "Late fee",
    isDeleted: false,
    longStayId: null,
    netIncome: 75,
    propertyId: "prop-1",
    refundedAmount: null,
    refundedAt: null,
    refundedBy: null,
    rentPeriodKey: null,
    reservationId: null,
    taxBreakdown: [],
    tenantRentPaymentId: null,
    transactionDate: "2026-01-15",
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
