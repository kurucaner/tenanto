import { testDateTime, testIsoDate } from "../dates";
import { buildReservationRow } from "../db-rows/reservation-row";
import { labelFromIndex, sequentialUuid } from "../ids";

const RESERVATION_PAGE_SPECS = [
  {
    channelCommission: "10.00",
    checkOutOffset: 2,
    grossIncome: "100.00",
    index: 0,
    netIncome: "90.00",
    nights: 2,
    roomTotal: "100.00",
  },
  {
    channelCommission: "5.00",
    checkOutOffset: 2,
    grossIncome: "50.00",
    index: -1,
    netIncome: "45.00",
    nights: 2,
    roomTotal: "50.00",
  },
  {
    channelCommission: "2.50",
    checkOutOffset: 1,
    grossIncome: "25.00",
    index: -2,
    netIncome: "22.50",
    nights: 1,
    roomTotal: "25.00",
  },
] as const;

export function buildDescendingReservationRows(): Record<string, unknown>[] {
  return RESERVATION_PAGE_SPECS.map((spec, rowIndex) =>
    buildReservationRow({
      channel_commission: spec.channelCommission,
      check_in: testIsoDate(spec.index),
      check_out: testIsoDate(spec.index + spec.checkOutOffset),
      created_at: testDateTime(spec.index),
      gross_income: spec.grossIncome,
      guest_name: `Guest ${labelFromIndex(rowIndex)}`,
      id: sequentialUuid(rowIndex + 1),
      net_income: spec.netIncome,
      nights: spec.nights,
      room_total: spec.roomTotal,
      updated_at: testDateTime(spec.index),
    })
  );
}
