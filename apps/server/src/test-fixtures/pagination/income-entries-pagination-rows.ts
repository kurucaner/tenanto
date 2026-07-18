import { IncomeEntryKind } from "@/packages/shared";

import { buildIncomeLineRow } from "../db-rows/income-line-row";
import { buildReservationRow } from "../db-rows/reservation-row";
import { TEST_CHANNEL_ID, TEST_INCOME_LINE_TYPE_ID } from "../ids";

export const INCOME_ENTRIES_LINE_TYPE_ID = "ilt00000-0000-4000-8000-000000000001";

export const incomeEntriesStayRowA = buildReservationRow({
  channel_commission_id: TEST_CHANNEL_ID,
  check_in: "2026-07-10",
  check_out: "2026-07-12",
  created_at: new Date("2026-07-10T10:00:00.000Z"),
  guest_name: "Guest Stay",
  updated_at: new Date("2026-07-10T10:00:00.000Z"),
});

export const incomeEntriesStayRowB = buildReservationRow({
  ...incomeEntriesStayRowA,
  check_in: "2026-07-09",
  check_out: "2026-07-11",
  created_at: new Date("2026-07-09T10:00:00.000Z"),
  guest_name: "Guest Stay B",
  id: "22222222-2222-4222-8222-222222222222",
  updated_at: new Date("2026-07-09T10:00:00.000Z"),
});

export const incomeEntriesLineRowA = buildIncomeLineRow({
  amount: "25.00",
  created_at: new Date("2026-07-09T15:00:00.000Z"),
  gross_income: "25.00",
  id: "33333333-3333-4333-8333-333333333333",
  income_line_type_id: INCOME_ENTRIES_LINE_TYPE_ID,
  net_income: "25.00",
  updated_at: new Date("2026-07-09T15:00:00.000Z"),
});

export const incomeEntriesLineRowB = buildIncomeLineRow({
  ...incomeEntriesLineRowA,
  amount: "15.00",
  created_at: new Date("2026-07-08T10:00:00.000Z"),
  gross_income: "15.00",
  id: "44444444-4444-4444-8444-444444444444",
  net_income: "15.00",
  transaction_date: "2026-07-08",
  updated_at: new Date("2026-07-08T10:00:00.000Z"),
});

export const incomeEntriesMergedRowsCanonical = [
  {
    created_at: incomeEntriesStayRowA.created_at,
    entry_kind: IncomeEntryKind.STAY,
    id: incomeEntriesStayRowA.id,
    row_payload: incomeEntriesStayRowA,
    sort_key_date: incomeEntriesStayRowA.check_in,
    sort_key_num: null,
    sort_key_text: null,
  },
  {
    created_at: incomeEntriesLineRowA.created_at,
    entry_kind: IncomeEntryKind.LINE,
    id: incomeEntriesLineRowA.id,
    row_payload: incomeEntriesLineRowA,
    sort_key_date: incomeEntriesLineRowA.transaction_date,
    sort_key_num: null,
    sort_key_text: null,
  },
  {
    created_at: incomeEntriesStayRowB.created_at,
    entry_kind: IncomeEntryKind.STAY,
    id: incomeEntriesStayRowB.id,
    row_payload: incomeEntriesStayRowB,
    sort_key_date: incomeEntriesStayRowB.check_in,
    sort_key_num: null,
    sort_key_text: null,
  },
  {
    created_at: incomeEntriesLineRowB.created_at,
    entry_kind: IncomeEntryKind.LINE,
    id: incomeEntriesLineRowB.id,
    row_payload: incomeEntriesLineRowB,
    sort_key_date: incomeEntriesLineRowB.transaction_date,
    sort_key_num: null,
    sort_key_text: null,
  },
];

export { TEST_CHANNEL_ID, TEST_INCOME_LINE_TYPE_ID };
