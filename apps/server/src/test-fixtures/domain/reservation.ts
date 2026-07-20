import { type IPropertyReservation, ReservationStatus } from "@/packages/shared";

export function makeReservation(
  overrides: Partial<IPropertyReservation> = {}
): IPropertyReservation {
  return {
    channelCommission: 10,
    channelCommissionId: "channel-airbnb",
    channelCommissionRate: 0.1,
    channelName: "Airbnb",
    checkIn: "2026-01-05",
    checkOut: "2026-01-08",
    cleaningFee: 50,
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    excludeCleaningFromCommissionBase: false,
    excludeResortTaxFromPayout: true,
    grossIncome: 500,
    guestName: "Guest",
    id: "stay-1",
    isDeleted: false,
    netIncome: 400,
    nights: 3,
    propertyId: "prop-1",
    refundedAmount: null,
    refundedAt: null,
    refundedBy: null,
    reservationNumber: null,
    roomTotal: 450,
    status: ReservationStatus.STAYED,
    taxBreakdown: [],
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Alias used in report and income tests. */
export const makeStay = makeReservation;
