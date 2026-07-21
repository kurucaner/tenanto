import { type ICreatePropertyIncomeLineBody,resolveIncomeLineRentPeriodKey } from "@/packages/shared";
import { parseDateString, parseUuidParam } from "@/routes/admin/admin-query-utils";
import {
  parseJsonObject,
  parseMoney,
  parseOptionalPeriodMonthField,
  parseOptionalTrimmedStringField,
  parseOptionalUuidField,
} from "@/routes/admin/parse-body-utils";

function parseIncomeLineTypeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return parseUuidParam(raw);
}

function parseOptionalRentPeriodKeyField(
  r: Record<string, unknown>
): { ok: true; value: string | undefined } | { error: string; ok: false } {
  const rentPeriodKeyResult = parseOptionalPeriodMonthField(r["rentPeriodKey"], "rentPeriodKey");
  if (!rentPeriodKeyResult.ok) return rentPeriodKeyResult;

  const rentPeriodMonthResult = parseOptionalPeriodMonthField(
    r["rentPeriodMonth"],
    "rentPeriodMonth"
  );
  if (!rentPeriodMonthResult.ok) return rentPeriodMonthResult;

  const resolved = resolveIncomeLineRentPeriodKey({
    rentPeriodKey: rentPeriodKeyResult.value,
    rentPeriodMonth: rentPeriodMonthResult.value,
  });

  return { ok: true, value: resolved };
}

export function parseCreateIncomeLineBody(
  raw: unknown
): { body: ICreatePropertyIncomeLineBody; ok: true } | { error: string; ok: false } {
  const r = parseJsonObject(raw);
  if (!r) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const unitIdResult = parseOptionalUuidField(r["unitId"], "unitId");
  if (!unitIdResult.ok) return unitIdResult;
  const unitId = unitIdResult.value ?? null;

  const transactionDate = parseDateString(r["transactionDate"]);
  if (!transactionDate) {
    return { error: "transactionDate must be a YYYY-MM-DD date", ok: false };
  }

  const amount = parseMoney(r["amount"]);
  if (amount === null) return { error: "amount must be a non-negative number", ok: false };

  const reservationResult = parseOptionalUuidField(r["reservationId"], "reservationId");
  if (!reservationResult.ok) return reservationResult;
  const longStayResult = parseOptionalUuidField(r["longStayId"], "longStayId");
  if (!longStayResult.ok) return longStayResult;

  if (reservationResult.value && longStayResult.value) {
    return { error: "Cannot link an income line to both a reservation and a long stay", ok: false };
  }

  let incomeLineTypeId: string | undefined;
  if (longStayResult.value) {
    const incomeLineTypeResult = parseOptionalUuidField(r["incomeLineTypeId"], "incomeLineTypeId");
    if (!incomeLineTypeResult.ok) return incomeLineTypeResult;
  } else {
    const parsedTypeId = parseIncomeLineTypeId(r["incomeLineTypeId"]);
    if (parsedTypeId === null) {
      return { error: "incomeLineTypeId must be a valid UUID", ok: false };
    }
    incomeLineTypeId = parsedTypeId;
  }

  const descriptionResult = parseOptionalTrimmedStringField(r["description"], "description");
  if (!descriptionResult.ok) return descriptionResult;
  const guestNameResult = parseOptionalTrimmedStringField(r["guestName"], "guestName");
  if (!guestNameResult.ok) return guestNameResult;

  const rentPeriodKeyResult = parseOptionalRentPeriodKeyField(r);
  if (!rentPeriodKeyResult.ok) return rentPeriodKeyResult;

  return {
    body: {
      amount,
      description: descriptionResult.value,
      guestName: guestNameResult.value,
      incomeLineTypeId,
      longStayId: longStayResult.value,
      rentPeriodKey: rentPeriodKeyResult.value,
      reservationId: reservationResult.value,
      transactionDate,
      unitId,
    },
    ok: true,
  };
}
