import {
  type IIncomeImportParsedRow,
  type IIncomeImportParseResponse,
  type IIncomeImportPreviewContext,
  recomputeIncomeImportPreviewRow,
  ReservationStatus,
} from "@/packages/shared";

function resolveMockUnit(context: IIncomeImportPreviewContext) {
  const preferredUnit = context.units.find((unit) => unit.unitNumber.trim() === "210");
  return preferredUnit ?? context.units[0] ?? null;
}

function resolveMockChannel(context: IIncomeImportPreviewContext) {
  const preferredChannel = context.channels.find((channel) =>
    channel.name.toLowerCase().includes("booking")
  );
  return preferredChannel ?? context.channels[0] ?? null;
}

function buildMockRow(
  context: IIncomeImportPreviewContext,
  overrides: Partial<IIncomeImportParsedRow> & Pick<IIncomeImportParsedRow, "guestName" | "rowIndex">
): IIncomeImportParsedRow {
  const unit = resolveMockUnit(context);
  const channel = resolveMockChannel(context);

  if (!unit || !channel) {
    throw new Error("Property needs at least one short-term unit and channel for mock data");
  }

  const { guestName, rowIndex, ...rowOverrides } = overrides;

  return recomputeIncomeImportPreviewRow(
    {
      channelCommissionId: channel.id,
      checkIn: "2026-02-07",
      checkOut: "2026-02-08",
      cleaningFee: 0,
      guestName,
      nights: 1,
      refunded: false,
      roomNo: unit.unitNumber,
      roomTotal: 121.63,
      rowIndex,
      sourceFileName: "mock-hotel-tax-calculator.csv",
      status: ReservationStatus.STAYED,
      unitId: unit.id,
      ...rowOverrides,
    },
    context
  );
}

export function buildIncomeImportMockParseResponse(
  context: IIncomeImportPreviewContext
): IIncomeImportParseResponse {
  const rows = [
    buildMockRow(context, {
      guestName: "Alexandar Kopilovic",
      rowIndex: 1,
      status: ReservationStatus.STAYED,
    }),
    buildMockRow(context, {
      checkIn: "2026-02-10",
      checkOut: "2026-02-12",
      guestName: "Canceled Guest",
      nights: 2,
      rowIndex: 2,
      status: ReservationStatus.CANCELED,
    }),
    buildMockRow(context, {
      checkIn: "2026-02-14",
      checkOut: "2026-02-15",
      guestName: "No Show Guest",
      rowIndex: 3,
      status: ReservationStatus.NO_SHOW,
    }),
    buildMockRow(context, {
      guestName: "Refund Guest",
      refunded: true,
      roomTotal: 0,
      rowIndex: 4,
      status: ReservationStatus.STAYED,
    }),
  ];

  const invalidCount = rows.filter((row) => row.validationError).length;

  return {
    files: [
      {
        fileName: "mock-hotel-tax-calculator.csv",
        message:
          invalidCount > 0
            ? `${rows.length} stay row(s) found (${invalidCount} need attention)`
            : `${rows.length} stay row(s) ready for review`,
        rows,
        status: "parsed",
      },
    ],
  };
}
