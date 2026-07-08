import { propertyExpensesDb } from "@/db/property-expenses";
import { propertyIncomeLinesDb } from "@/db/property-income-lines";
import { propertyReservationsDb } from "@/db/property-reservations";
import { propertyUnitsDb } from "@/db/property-units";
import {
  getExpenseCategoryMeta,
  type IPortfolioPropertyReportRow,
  type IPortfolioReportSummary,
  type IPropertyExpense,
  type IPropertyIncomeLine,
  type IPropertyReportChannelSummary,
  type IPropertyReportExpenseCategory,
  type IPropertyReportMonthSummary,
  type IPropertyReportOtherIncomeByType,
  type IPropertyReportSalesTypeBreakdown,
  type IPropertyReportsQuery,
  type IPropertyReportSummary,
  type IPropertyReportUnitSummary,
  type IPropertyReservation,
  type IPropertyUnit,
  PROPERTY_AMENITY_UNIT_LABEL,
  ReportRentalTypeFilter,
  ReservationChannel,
  ReservationStatus,
  type TExpenseCategory,
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
  if (query.unitId) {
    const match = units.find((unit) => unit.id === query.unitId);
    return match ? [match] : [];
  }

  const rentalType = resolveRentalTypeFilter(query.rentalType);
  if (!rentalType) return units;

  return units.filter((unit) => unit.rentalType === rentalType);
}

function shouldIncludeExpenses(_units: IPropertyUnit[], query: IPropertyReportsQuery): boolean {
  const rentalType = resolveRentalTypeFilter(query.rentalType);
  if (!rentalType) return true;
  return _units.some((unit) => unit.rentalType === rentalType);
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
  // Property-amenity lines (null unit) aren't tied to a rental type, so include them only
  // when no rental-type filter is narrowing the report.
  const rentalTypeFilterActive = resolveRentalTypeFilter(query.rentalType) !== undefined;
  const scopedLines = incomeLines.filter((line) =>
    line.unitId === null ? !rentalTypeFilterActive : unitIds.has(line.unitId)
  );
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
    cleaningFromStays: 0,
    otherIncomeByType: [],
    room: 0,
  };
}

function addOtherIncomeToBreakdown(
  breakdown: IPropertyReportSalesTypeBreakdown,
  line: IPropertyIncomeLine
): void {
  const typeName = line.incomeLineTypeName ?? line.incomeLineTypeId;
  const existing = breakdown.otherIncomeByType.find(
    (row) => row.incomeLineTypeId === line.incomeLineTypeId
  );
  if (existing) {
    existing.amount = roundMoney(existing.amount + line.amount);
    return;
  }

  breakdown.otherIncomeByType.push({
    amount: line.amount,
    incomeLineTypeId: line.incomeLineTypeId,
    name: typeName,
  });
}

function mergeOtherIncomeByType(
  target: IPropertyReportOtherIncomeByType[],
  source: IPropertyReportOtherIncomeByType[]
): void {
  for (const row of source) {
    const existing = target.find((entry) => entry.name === row.name);
    if (existing) {
      existing.amount = roundMoney(existing.amount + row.amount);
      continue;
    }
    target.push({ ...row });
  }
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
        adrNights: 0,
        adrRoomTotal: 0,
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
  let amenityGrossIncome = 0;
  let amenityNetIncome = 0;

  for (const stay of reservations) {
    grossIncome = roundMoney(grossIncome + stay.grossIncome);
    netIncome = roundMoney(netIncome + stay.netIncome);

    salesTypeBreakdown.room = roundMoney(salesTypeBreakdown.room + stay.roomRate * stay.nights);
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
        unit.adrRoomTotal = roundMoney(unit.adrRoomTotal + stay.roomRate * stay.nights);
        unit.adrNights += stay.nights;
      }
    }

    addToMonth(monthMap, monthFromDate(stay.checkIn), stay.grossIncome, stay.netIncome);
  }

  for (const line of incomeLines) {
    grossIncome = roundMoney(grossIncome + line.grossIncome);
    netIncome = roundMoney(netIncome + line.netIncome);

    addOtherIncomeToBreakdown(salesTypeBreakdown, line);

    if (line.unitId === null) {
      // Property-amenity income: not tied to a rentable unit — its own bucket.
      amenityGrossIncome = roundMoney(amenityGrossIncome + line.grossIncome);
      amenityNetIncome = roundMoney(amenityNetIncome + line.netIncome);
    } else {
      const unit = unitMap.get(line.unitId);
      if (unit) {
        unit.grossIncome = roundMoney(unit.grossIncome + line.grossIncome);
        unit.netIncome = roundMoney(unit.netIncome + line.netIncome);
      }
    }

    addToMonth(monthMap, monthFromDate(line.transactionDate), line.grossIncome, line.netIncome);
  }

  salesTypeBreakdown.otherIncomeByType.sort((a, b) => a.name.localeCompare(b.name));

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

  if (amenityGrossIncome !== 0 || amenityNetIncome !== 0) {
    byUnit.push({
      adr: 0,
      availableNights: 0,
      bookedNights: 0,
      grossIncome: amenityGrossIncome,
      netIncome: amenityNetIncome,
      occupancyRate: 0,
      rentalType: null,
      unitId: "property-amenity",
      unitNumber: PROPERTY_AMENITY_UNIT_LABEL,
    });
  }

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

const PORTFOLIO_BATCH_SIZE = 8;

function emptyPropertyReportSummary(query: IPropertyReportsQuery): IPropertyReportSummary {
  const months = listMonthsInRange(query.from, query.to);
  return {
    byMonth: months.map((month) => ({
      expenses: 0,
      grossIncome: 0,
      month,
      netIncome: 0,
      operationalNet: 0,
    })),
    byUnit: [],
    channelSummary: [],
    expenseByCategory: [],
    filters: query,
    period: { from: query.from, to: query.to },
    propertyExpensesTotal: 0,
    salesTypeBreakdown: initSalesBreakdown(),
    totals: {
      grossIncome: 0,
      netIncome: 0,
      operationalNet: 0,
      totalExpenses: 0,
    },
  };
}

export function rollupSummaries(
  summaries: IPropertyReportSummary[],
  query: IPropertyReportsQuery
): IPropertyReportSummary {
  if (summaries.length === 0) return emptyPropertyReportSummary(query);

  const salesTypeBreakdown = initSalesBreakdown();
  const channelMap = new Map<TReservationChannel, IPropertyReportChannelSummary>();
  const monthMap = new Map<string, IPropertyReportMonthSummary>();
  const expenseCategoryMap = new Map<TExpenseCategory, number>();
  const byUnit: IPropertyReportUnitSummary[] = [];

  let propertyExpensesTotal = 0;
  let grossIncome = 0;
  let netIncome = 0;
  let totalExpenses = 0;

  for (const summary of summaries) {
    grossIncome = roundMoney(grossIncome + summary.totals.grossIncome);
    netIncome = roundMoney(netIncome + summary.totals.netIncome);
    totalExpenses = roundMoney(totalExpenses + summary.totals.totalExpenses);
    propertyExpensesTotal = roundMoney(propertyExpensesTotal + summary.propertyExpensesTotal);

    salesTypeBreakdown.room = roundMoney(salesTypeBreakdown.room + summary.salesTypeBreakdown.room);
    salesTypeBreakdown.cleaningFromStays = roundMoney(
      salesTypeBreakdown.cleaningFromStays + summary.salesTypeBreakdown.cleaningFromStays
    );
    mergeOtherIncomeByType(
      salesTypeBreakdown.otherIncomeByType,
      summary.salesTypeBreakdown.otherIncomeByType
    );

    for (const row of summary.channelSummary) {
      const existing = channelMap.get(row.channel);
      if (existing) {
        existing.grossIncome = roundMoney(existing.grossIncome + row.grossIncome);
        existing.channelCommission = roundMoney(existing.channelCommission + row.channelCommission);
        existing.stayCount += row.stayCount;
      } else {
        channelMap.set(row.channel, { ...row });
      }
    }

    byUnit.push(...summary.byUnit);

    for (const row of summary.byMonth) {
      const existing = monthMap.get(row.month);
      if (existing) {
        existing.grossIncome = roundMoney(existing.grossIncome + row.grossIncome);
        existing.netIncome = roundMoney(existing.netIncome + row.netIncome);
        existing.expenses = roundMoney(existing.expenses + row.expenses);
        existing.operationalNet = roundMoney(existing.operationalNet + row.operationalNet);
      } else {
        monthMap.set(row.month, { ...row });
      }
    }

    for (const row of summary.expenseByCategory) {
      expenseCategoryMap.set(
        row.category,
        roundMoney((expenseCategoryMap.get(row.category) ?? 0) + row.amount)
      );
    }
  }

  const months = listMonthsInRange(query.from, query.to);
  const byMonth = months.map(
    (month) =>
      monthMap.get(month) ?? {
        expenses: 0,
        grossIncome: 0,
        month,
        netIncome: 0,
        operationalNet: 0,
      }
  );

  const channelSummary = [...channelMap.values()].sort((a, b) => b.grossIncome - a.grossIncome);
  salesTypeBreakdown.otherIncomeByType.sort((a, b) => a.name.localeCompare(b.name));
  const expenseByCategory: IPropertyReportExpenseCategory[] = [...expenseCategoryMap.entries()]
    .map(([category, amount]) => ({ amount, category }))
    .sort((a, b) => b.amount - a.amount);

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

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function buildPortfolioReportSummary(
  properties: { id: string; name: string }[],
  query: IPropertyReportsQuery
): Promise<IPortfolioReportSummary> {
  const summaries = await runInBatches(properties, PORTFOLIO_BATCH_SIZE, async (property) => {
    const data = await loadReportData(property.id, query);
    return buildPropertyReportSummary(data, query);
  });

  const propertyRows: IPortfolioPropertyReportRow[] = properties.map((property, index) => ({
    propertyId: property.id,
    propertyName: property.name,
    summary: summaries[index]!,
  }));

  return {
    from: query.from,
    properties: propertyRows,
    rentalType: query.rentalType,
    to: query.to,
    totals: rollupSummaries(summaries, query),
  };
}

function appendPropertyReportCsvSections(csv: string, summary: IPropertyReportSummary): string {
  let next = csv;
  next += csvRow(["Totals"]);
  next += csvRow(["Gross Income", summary.totals.grossIncome]);
  next += csvRow(["Net Income", summary.totals.netIncome]);
  next += csvRow(["Total Expenses", summary.totals.totalExpenses]);
  next += csvRow(["Operational Net", summary.totals.operationalNet]);
  next += "\n";
  next += csvRow(["Sales Type Breakdown"]);
  next += csvRow(["Room", summary.salesTypeBreakdown.room]);
  next += csvRow(["Cleaning (stays)", summary.salesTypeBreakdown.cleaningFromStays]);
  for (const row of summary.salesTypeBreakdown.otherIncomeByType) {
    next += csvRow([row.name, row.amount]);
  }
  next += "\n";
  next += csvRow(["Channel Summary", "Gross Income", "Commission", "Stays"]);
  for (const row of summary.channelSummary) {
    next += csvRow([row.channel, row.grossIncome, row.channelCommission, row.stayCount]);
  }
  next += "\n";
  next += csvRow([
    "By Unit",
    "Gross Income",
    "Net Income",
    "Booked Nights",
    "Available Nights",
    "Occupancy",
    "ADR",
  ]);
  for (const row of summary.byUnit) {
    next += csvRow([
      row.unitNumber,
      row.grossIncome,
      row.netIncome,
      row.bookedNights,
      row.availableNights,
      row.occupancyRate,
      row.adr,
    ]);
  }
  next += "\n";
  next += csvRow(["By Month", "Gross Income", "Net Income", "Expenses", "Operational Net"]);
  for (const row of summary.byMonth) {
    next += csvRow([row.month, row.grossIncome, row.netIncome, row.expenses, row.operationalNet]);
  }
  next += "\n";
  next += csvRow(["Expenses by Category", "Amount"]);
  for (const row of summary.expenseByCategory) {
    next += csvRow([row.category, row.amount]);
  }
  return next;
}

export function buildPropertyReportCsv(summary: IPropertyReportSummary): string {
  let csv = "";
  csv += csvRow(["Property Report"]);
  csv += csvRow(["Period", `${summary.period.from} to ${summary.period.to}`]);
  csv += "\n";
  return appendPropertyReportCsvSections(csv, summary);
}

export function buildPortfolioReportCsv(summary: IPortfolioReportSummary): string {
  let csv = "";
  csv += csvRow(["Portfolio Report"]);
  csv += csvRow(["Period", `${summary.from} to ${summary.to}`]);
  if (summary.rentalType) {
    csv += csvRow(["Rental Type Filter", summary.rentalType]);
  }
  csv += "\n";
  csv += csvRow(["Portfolio Totals"]);
  csv += "\n";
  csv = appendPropertyReportCsvSections(csv, summary.totals);

  for (const row of summary.properties) {
    csv += "\n";
    csv += csvRow(["Property", row.propertyName]);
    csv += csvRow(["Property ID", row.propertyId]);
    csv += "\n";
    csv = appendPropertyReportCsvSections(csv, row.summary);
  }

  return csv;
}
