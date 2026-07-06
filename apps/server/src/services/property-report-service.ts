import { propertyExpensesDb } from "@/db/property-expenses";
import { propertyIncomeLinesDb } from "@/db/property-income-lines";
import { propertyReservationsDb } from "@/db/property-reservations";
import { propertyUnitsDb } from "@/db/property-units";
import {
  getExpenseCategoryMeta,
  IncomeLineType,
  type IPropertyExpense,
  type IPropertyIncomeLine,
  type IPropertyReportChannelSummary,
  type IPropertyReportExpenseCategory,
  type IPropertyReportMonthSummary,
  type IPropertyReportSalesTypeBreakdown,
  type IPropertyReportSummary,
  type IPropertyReportUnitSummary,
  type IPropertyReportsQuery,
  type IPropertyReservation,
  type IPropertyUnit,
  type TExpenseCategory,
  ReportRentalTypeFilter,
  ReservationChannel,
  ReservationStatus,
  type TReportRentalTypeFilter,
  type TReservationChannel,
  type TUnitRentalType,
} from "@/packages/shared";
import { roundMoney } from "@/services/property-income-calculator";

const MS_PER_DAY = 86_400_000;

export interface IReportData {
  expenses: IPropertyExpense[];
  incomeLines: IPropertyIncomeLine[];
  reservations: IPropertyReservation[];
  units: IPropertyUnit[];
}

function parseIsoDate(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

function daysInRange(from: string, to: string): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

function nightsOverlappingRange(
  checkIn: string,
  checkOut: string,
  from: string,
  to: string
): number {
  const rangeStart = parseIsoDate(from);
  const rangeEnd = parseIsoDate(to) + MS_PER_DAY;
  const stayStart = parseIsoDate(checkIn);
  const stayEnd = parseIsoDate(checkOut);
  const overlapStart = Math.max(stayStart, rangeStart);
  const overlapEnd = Math.min(stayEnd, rangeEnd);
  if (overlapEnd <= overlapStart) return 0;
  return Math.round((overlapEnd - overlapStart) / MS_PER_DAY);
}

function isOccupancyStay(status: IPropertyReservation["status"]): boolean {
  return status === ReservationStatus.STAYED || status === ReservationStatus.ACTIVE;
}

function resolveRentalTypeFilter(
  rentalType?: TReportRentalTypeFilter
): TUnitRentalType | undefined {
  if (!rentalType || rentalType === ReportRentalTypeFilter.BOTH) return undefined;
  return rentalType;
}

function filterUnits(units: IPropertyUnit[], query: IPropertyReportsQuery): IPropertyUnit[] {
  let scoped = units;
  const rentalType = resolveRentalTypeFilter(query.rentalType);
  if (rentalType) {
    scoped = scoped.filter((unit) => unit.rentalType === rentalType);
  }
  if (query.unitId) {
    scoped = scoped.filter((unit) => unit.id === query.unitId);
  }
  return scoped;
}

function shouldIncludeExpenses(units: IPropertyUnit[], query: IPropertyReportsQuery): boolean {
  const rentalType = resolveRentalTypeFilter(query.rentalType);
  if (!rentalType) return true;
  return units.some((unit) => unit.rentalType === rentalType);
}

function listMonthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor <= end) {
    const month = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!months.includes(month)) months.push(month);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function monthFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export async function loadReportData(
  propertyId: string,
  query: IPropertyReportsQuery
): Promise<IReportData> {
  const rentalType = resolveRentalTypeFilter(query.rentalType);
  const listFilters = {
    channel: query.channel,
    from: query.from,
    rentalType,
    to: query.to,
    unitId: query.unitId,
  };

  const [allUnits, reservations, incomeLines, allExpenses] = await Promise.all([
    propertyUnitsDb.findByProperty(propertyId),
    propertyReservationsDb.findByProperty(propertyId, listFilters),
    propertyIncomeLinesDb.findByProperty(propertyId, listFilters),
    propertyExpensesDb.findByProperty(propertyId),
  ]);

  const units = filterUnits(allUnits, query);
  const unitIds = new Set(units.map((unit) => unit.id));
  const includeExpenses = shouldIncludeExpenses(allUnits, query);

  const scopedReservations = reservations.filter((stay) => unitIds.has(stay.unitId));
  const scopedLines = incomeLines.filter((line) => unitIds.has(line.unitId));
  const scopedExpenses = includeExpenses
    ? allExpenses.filter(
        (expense) =>
          !expense.expenseDate ||
          (expense.expenseDate >= query.from && expense.expenseDate <= query.to)
      )
    : [];

  return {
    expenses: scopedExpenses,
    incomeLines: scopedLines,
    reservations: scopedReservations,
    units,
  };
}

function initSalesBreakdown(): IPropertyReportSalesTypeBreakdown {
  return {
    beachRental: 0,
    cleaningFromStays: 0,
    cleaningOnly: 0,
    extraCleaning: 0,
    extraService: 0,
    room: 0,
    totalCleaning: 0,
  };
}

function initChannelMap(): Map<TReservationChannel, IPropertyReportChannelSummary> {
  const channels = Object.values(ReservationChannel) as TReservationChannel[];
  return new Map(
    channels.map((channel) => [
      channel,
      { channel, channelCommission: 0, grossIncome: 0, stayCount: 0 },
    ])
  );
}

function initUnitMap(units: IPropertyUnit[], from: string, to: string) {
  const days = daysInRange(from, to);
  return new Map(
    units.map((unit) => [
      unit.id,
      {
        adr: 0,
        adrRoomTotal: 0,
        adrNights: 0,
        availableNights: days,
        bookedNights: 0,
        grossIncome: 0,
        netIncome: 0,
        rentalType: unit.rentalType,
        unitId: unit.id,
        unitNumber: unit.unitNumber,
      },
    ])
  );
}

function initMonthMap(months: string[]): Map<string, IPropertyReportMonthSummary> {
  return new Map(
    months.map((month) => [
      month,
      { expenses: 0, grossIncome: 0, month, netIncome: 0, operationalNet: 0 },
    ])
  );
}

function addToMonth(
  monthMap: Map<string, IPropertyReportMonthSummary>,
  month: string,
  gross: number,
  net: number
) {
  const entry = monthMap.get(month);
  if (!entry) return;
  entry.grossIncome = roundMoney(entry.grossIncome + gross);
  entry.netIncome = roundMoney(entry.netIncome + net);
}

function addExpenseToMonth(
  monthMap: Map<string, IPropertyReportMonthSummary>,
  month: string,
  amount: number
) {
  const entry = monthMap.get(month);
  if (!entry) return;
  entry.expenses = roundMoney(entry.expenses + amount);
}

export function buildPropertyReportSummary(
  data: IReportData,
  query: IPropertyReportsQuery
): IPropertyReportSummary {
  const { expenses, incomeLines, reservations, units } = data;
  const months = listMonthsInRange(query.from, query.to);
  const salesTypeBreakdown = initSalesBreakdown();
  const channelMap = initChannelMap();
  const unitMap = initUnitMap(units, query.from, query.to);
  const monthMap = initMonthMap(months);
  const expenseCategoryMap = new Map<TExpenseCategory, number>();

  let grossIncome = 0;
  let netIncome = 0;
  let propertyExpensesTotal = 0;

  for (const stay of reservations) {
    grossIncome = roundMoney(grossIncome + stay.grossIncome);
    netIncome = roundMoney(netIncome + stay.netIncome);

    salesTypeBreakdown.room = roundMoney(salesTypeBreakdown.room + stay.roomRate);
    salesTypeBreakdown.cleaningFromStays = roundMoney(
      salesTypeBreakdown.cleaningFromStays + stay.cleaningFee
    );

    const channel = channelMap.get(stay.channel);
    if (channel) {
      channel.grossIncome = roundMoney(channel.grossIncome + stay.grossIncome);
      channel.channelCommission = roundMoney(channel.channelCommission + stay.channelCommission);
      channel.stayCount += 1;
    }

    const unit = unitMap.get(stay.unitId);
    if (unit) {
      unit.grossIncome = roundMoney(unit.grossIncome + stay.grossIncome);
      unit.netIncome = roundMoney(unit.netIncome + stay.netIncome);
      if (isOccupancyStay(stay.status)) {
        const booked = nightsOverlappingRange(stay.checkIn, stay.checkOut, query.from, query.to);
        unit.bookedNights += booked;
        unit.adrRoomTotal = roundMoney(unit.adrRoomTotal + stay.roomRate);
        unit.adrNights += stay.nights;
      }
    }

    addToMonth(monthMap, monthFromDate(stay.checkIn), stay.grossIncome, stay.netIncome);
  }

  for (const line of incomeLines) {
    grossIncome = roundMoney(grossIncome + line.grossIncome);
    netIncome = roundMoney(netIncome + line.netIncome);

    switch (line.lineType) {
      case IncomeLineType.CLEANING_ONLY:
        salesTypeBreakdown.cleaningOnly = roundMoney(salesTypeBreakdown.cleaningOnly + line.amount);
        break;
      case IncomeLineType.EXTRA_CLEANING:
        salesTypeBreakdown.extraCleaning = roundMoney(
          salesTypeBreakdown.extraCleaning + line.amount
        );
        break;
      case IncomeLineType.EXTRA_SERVICE:
        salesTypeBreakdown.extraService = roundMoney(salesTypeBreakdown.extraService + line.amount);
        break;
      case IncomeLineType.BEACH_EQUIPMENT_RENTAL:
        salesTypeBreakdown.beachRental = roundMoney(salesTypeBreakdown.beachRental + line.amount);
        break;
    }

    const unit = unitMap.get(line.unitId);
    if (unit) {
      unit.grossIncome = roundMoney(unit.grossIncome + line.grossIncome);
      unit.netIncome = roundMoney(unit.netIncome + line.netIncome);
    }

    addToMonth(monthMap, monthFromDate(line.transactionDate), line.grossIncome, line.netIncome);
  }

  salesTypeBreakdown.totalCleaning = roundMoney(
    salesTypeBreakdown.cleaningFromStays + salesTypeBreakdown.cleaningOnly
  );

  for (const expense of expenses) {
    const meta = getExpenseCategoryMeta(expense.category);
    propertyExpensesTotal = roundMoney(propertyExpensesTotal + expense.amount);
    expenseCategoryMap.set(
      expense.category,
      roundMoney((expenseCategoryMap.get(expense.category) ?? 0) + expense.amount)
    );

    if (meta.isAnnualAmount) {
      const monthlyAmount = roundMoney(expense.amount / 12);
      for (const month of months) {
        addExpenseToMonth(monthMap, month, monthlyAmount);
      }
    } else if (expense.expenseDate) {
      addExpenseToMonth(monthMap, monthFromDate(expense.expenseDate), expense.amount);
    }
  }

  const byUnit: IPropertyReportUnitSummary[] = [...unitMap.values()].map((unit) => ({
    adr: unit.adrNights > 0 ? roundMoney(unit.adrRoomTotal / unit.adrNights) : 0,
    availableNights: unit.availableNights,
    bookedNights: unit.bookedNights,
    grossIncome: unit.grossIncome,
    netIncome: unit.netIncome,
    occupancyRate:
      unit.availableNights > 0 ? roundMoney(unit.bookedNights / unit.availableNights) : 0,
    rentalType: unit.rentalType,
    unitId: unit.unitId,
    unitNumber: unit.unitNumber,
  }));

  const byMonth: IPropertyReportMonthSummary[] = [...monthMap.values()].map((month) => ({
    ...month,
    operationalNet: roundMoney(month.netIncome - month.expenses),
  }));

  const channelSummary = [...channelMap.values()].filter((entry) => entry.stayCount > 0);
  const expenseByCategory: IPropertyReportExpenseCategory[] = [...expenseCategoryMap.entries()]
    .map(([category, amount]) => ({ amount, category }))
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = propertyExpensesTotal;

  return {
    byMonth,
    byUnit,
    channelSummary,
    expenseByCategory,
    filters: query,
    period: { from: query.from, to: query.to },
    propertyExpensesTotal,
    salesTypeBreakdown,
    totals: {
      grossIncome,
      netIncome,
      operationalNet: roundMoney(netIncome - totalExpenses),
      totalExpenses,
    },
  };
}

function csvEscape(value: string | number): string {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function csvRow(values: Array<string | number>): string {
  return `${values.map(csvEscape).join(",")}\n`;
}

export function buildPropertyReportCsv(summary: IPropertyReportSummary): string {
  let csv = "";
  csv += csvRow(["Property Report"]);
  csv += csvRow(["Period", `${summary.period.from} to ${summary.period.to}`]);
  csv += "\n";
  csv += csvRow(["Totals"]);
  csv += csvRow(["Gross Income", summary.totals.grossIncome]);
  csv += csvRow(["Net Income", summary.totals.netIncome]);
  csv += csvRow(["Total Expenses", summary.totals.totalExpenses]);
  csv += csvRow(["Operational Net", summary.totals.operationalNet]);
  csv += "\n";
  csv += csvRow(["Sales Type Breakdown"]);
  csv += csvRow(["Room", summary.salesTypeBreakdown.room]);
  csv += csvRow(["Cleaning (stays)", summary.salesTypeBreakdown.cleaningFromStays]);
  csv += csvRow(["Cleaning only", summary.salesTypeBreakdown.cleaningOnly]);
  csv += csvRow(["Total cleaning", summary.salesTypeBreakdown.totalCleaning]);
  csv += csvRow(["Extra cleaning", summary.salesTypeBreakdown.extraCleaning]);
  csv += csvRow(["Extra service", summary.salesTypeBreakdown.extraService]);
  csv += csvRow(["Beach rental", summary.salesTypeBreakdown.beachRental]);
  csv += "\n";
  csv += csvRow(["Channel Summary", "Gross Income", "Commission", "Stays"]);
  for (const row of summary.channelSummary) {
    csv += csvRow([row.channel, row.grossIncome, row.channelCommission, row.stayCount]);
  }
  csv += "\n";
  csv += csvRow([
    "By Unit",
    "Gross Income",
    "Net Income",
    "Booked Nights",
    "Available Nights",
    "Occupancy",
    "ADR",
  ]);
  for (const row of summary.byUnit) {
    csv += csvRow([
      row.unitNumber,
      row.grossIncome,
      row.netIncome,
      row.bookedNights,
      row.availableNights,
      row.occupancyRate,
      row.adr,
    ]);
  }
  csv += "\n";
  csv += csvRow(["By Month", "Gross Income", "Net Income", "Expenses", "Operational Net"]);
  for (const row of summary.byMonth) {
    csv += csvRow([row.month, row.grossIncome, row.netIncome, row.expenses, row.operationalNet]);
  }
  csv += "\n";
  csv += csvRow(["Expenses by Category", "Amount"]);
  for (const row of summary.expenseByCategory) {
    csv += csvRow([row.category, row.amount]);
  }
  return csv;
}
