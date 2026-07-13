import { propertyExpensesDb } from "@/db/property-expenses";
import { propertyIncomeLinesDb } from "@/db/property-income-lines";
import { propertyReservationsDb } from "@/db/property-reservations";
import { propertyUnitsDb } from "@/db/property-units";
import {
  getReportableIncomeLineAmounts,
  getReportableStayAmounts,
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
  type IPropertyReportTaxSummaryItem,
  type IPropertyReportUnitSummary,
  type IPropertyReservation,
  type IPropertyUnit,
  PROPERTY_AMENITY_UNIT_ID,
  PROPERTY_AMENITY_UNIT_LABEL,
  ReportRentalTypeFilter,
  ReservationStatus,
  type TReportRentalTypeFilter,
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
    channelCommissionId: query.channelCommissionId,
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
  line: Pick<IPropertyIncomeLine, "incomeLineTypeId" | "incomeLineTypeName">,
  amount: number
): void {
  const typeName = line.incomeLineTypeName ?? line.incomeLineTypeId;
  const existing = breakdown.otherIncomeByType.find(
    (row) => row.incomeLineTypeId === line.incomeLineTypeId
  );
  if (existing) {
    existing.amount = roundMoney(existing.amount + amount);
    return;
  }

  breakdown.otherIncomeByType.push({
    amount,
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

function upsertChannelSummary(
  channelMap: Map<string, IPropertyReportChannelSummary>,
  stay: Pick<IPropertyReservation, "channelCommissionId" | "channelName">,
  reportable: Pick<IPropertyReservation, "channelCommission" | "grossIncome">
): void {
  const existing = channelMap.get(stay.channelCommissionId);
  if (existing) {
    existing.grossIncome = roundMoney(existing.grossIncome + reportable.grossIncome);
    existing.channelCommission = roundMoney(
      existing.channelCommission + reportable.channelCommission
    );
    existing.stayCount += 1;
    return;
  }

  channelMap.set(stay.channelCommissionId, {
    channelCommission: reportable.channelCommission,
    channelCommissionId: stay.channelCommissionId,
    grossIncome: reportable.grossIncome,
    name: stay.channelName,
    stayCount: 1,
  });
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
        stayGrossIncome: 0,
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

function addTaxToMap(
  taxMap: Map<string, IPropertyReportTaxSummaryItem>,
  taxRateId: string,
  name: string,
  amount: number
): void {
  const existing = taxMap.get(taxRateId);
  if (existing) {
    existing.amount = roundMoney(existing.amount + amount);
    return;
  }
  taxMap.set(taxRateId, { amount, name, taxRateId });
}

function taxMapToSummary(
  taxMap: Map<string, IPropertyReportTaxSummaryItem>
): IPropertyReportTaxSummaryItem[] {
  return [...taxMap.values()].sort((a, b) => b.amount - a.amount);
}

function mergeTaxSummary(
  target: Map<string, IPropertyReportTaxSummaryItem>,
  source: IPropertyReportTaxSummaryItem[]
): void {
  for (const row of source) {
    addTaxToMap(target, row.taxRateId, row.name, row.amount);
  }
}

interface IPropertyReportAccumulator {
  amenityGrossIncome: number;
  amenityNetIncome: number;
  channelMap: Map<string, IPropertyReportChannelSummary>;
  expenseCategoryMap: Map<string, { amount: number; name: string }>;
  grossIncome: number;
  monthMap: Map<string, IPropertyReportMonthSummary>;
  netIncome: number;
  propertyExpensesTotal: number;
  salesTypeBreakdown: IPropertyReportSalesTypeBreakdown;
  taxMap: Map<string, IPropertyReportTaxSummaryItem>;
  unitMap: ReturnType<typeof initUnitMap>;
}

function applyReservationToReport(
  stay: IPropertyReservation,
  query: IPropertyReportsQuery,
  accumulator: IPropertyReportAccumulator
): void {
  const reportable = getReportableStayAmounts(stay);
  if (reportable.grossIncome === 0) return;

  accumulator.grossIncome = roundMoney(accumulator.grossIncome + reportable.grossIncome);
  accumulator.netIncome = roundMoney(accumulator.netIncome + reportable.netIncome);

  accumulator.salesTypeBreakdown.room = roundMoney(
    accumulator.salesTypeBreakdown.room + reportable.roomTotal
  );
  accumulator.salesTypeBreakdown.cleaningFromStays = roundMoney(
    accumulator.salesTypeBreakdown.cleaningFromStays + reportable.cleaningFee
  );

  upsertChannelSummary(accumulator.channelMap, stay, reportable);

  const unit = accumulator.unitMap.get(stay.unitId);
  if (unit) {
    unit.grossIncome = roundMoney(unit.grossIncome + reportable.grossIncome);
    unit.netIncome = roundMoney(unit.netIncome + reportable.netIncome);
    unit.stayGrossIncome = roundMoney(unit.stayGrossIncome + reportable.grossIncome);
    if (isOccupancyStay(stay.status)) {
      const booked = nightsOverlappingRange(stay.checkIn, stay.checkOut, query.from, query.to);
      unit.bookedNights += booked;
      unit.adrRoomTotal = roundMoney(unit.adrRoomTotal + reportable.roomTotal);
      unit.adrNights += stay.nights;
    }
  }

  addToMonth(
    accumulator.monthMap,
    monthFromDate(stay.checkIn),
    reportable.grossIncome,
    reportable.netIncome
  );

  for (const taxItem of reportable.taxBreakdown) {
    addTaxToMap(accumulator.taxMap, taxItem.taxRateId, taxItem.name, taxItem.amount);
  }
}

function applyIncomeLineToReport(
  line: IPropertyIncomeLine,
  accumulator: IPropertyReportAccumulator
): void {
  const reportable = getReportableIncomeLineAmounts(line);
  if (reportable.grossIncome === 0) return;

  accumulator.grossIncome = roundMoney(accumulator.grossIncome + reportable.grossIncome);
  accumulator.netIncome = roundMoney(accumulator.netIncome + reportable.netIncome);

  addOtherIncomeToBreakdown(accumulator.salesTypeBreakdown, line, reportable.amount);

  if (line.unitId === null) {
    accumulator.amenityGrossIncome = roundMoney(
      accumulator.amenityGrossIncome + reportable.grossIncome
    );
    accumulator.amenityNetIncome = roundMoney(accumulator.amenityNetIncome + reportable.netIncome);
    return;
  }

  const unit = accumulator.unitMap.get(line.unitId);
  if (unit) {
    unit.grossIncome = roundMoney(unit.grossIncome + reportable.grossIncome);
    unit.netIncome = roundMoney(unit.netIncome + reportable.netIncome);
  }

  addToMonth(
    accumulator.monthMap,
    monthFromDate(line.transactionDate),
    reportable.grossIncome,
    reportable.netIncome
  );
}

function applyExpenseToReport(
  expense: IPropertyExpense,
  months: string[],
  accumulator: IPropertyReportAccumulator
): void {
  accumulator.propertyExpensesTotal = roundMoney(
    accumulator.propertyExpensesTotal + expense.amount
  );

  const existing = accumulator.expenseCategoryMap.get(expense.categoryId);
  accumulator.expenseCategoryMap.set(expense.categoryId, {
    amount: roundMoney((existing?.amount ?? 0) + expense.amount),
    name: expense.categoryName,
  });

  if (expense.categoryIsAnnualAmount) {
    const monthlyAmount = roundMoney(expense.amount / 12);
    for (const month of months) {
      addExpenseToMonth(accumulator.monthMap, month, monthlyAmount);
    }
    return;
  }

  if (expense.expenseDate) {
    addExpenseToMonth(accumulator.monthMap, monthFromDate(expense.expenseDate), expense.amount);
  }
}

function buildUnitSummaries(
  unitMap: ReturnType<typeof initUnitMap>,
  amenityGrossIncome: number,
  amenityNetIncome: number
): IPropertyReportUnitSummary[] {
  const byUnit: IPropertyReportUnitSummary[] = [...unitMap.values()].map((unit) => ({
    adr: unit.adrNights > 0 ? roundMoney(unit.adrRoomTotal / unit.adrNights) : 0,
    availableNights: unit.availableNights,
    bookedNights: unit.bookedNights,
    grossIncome: unit.grossIncome,
    netIncome: unit.netIncome,
    occupancyRate:
      unit.availableNights > 0 ? roundMoney(unit.bookedNights / unit.availableNights) : 0,
    rentalType: unit.rentalType,
    stayGrossIncome: unit.stayGrossIncome,
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
      stayGrossIncome: 0,
      unitId: PROPERTY_AMENITY_UNIT_ID,
      unitNumber: PROPERTY_AMENITY_UNIT_LABEL,
    });
  }

  return byUnit;
}

interface IRollupAccumulator {
  byUnit: IPropertyReportUnitSummary[];
  channelMap: Map<string, IPropertyReportChannelSummary>;
  expenseCategoryMap: Map<string, { amount: number; name: string }>;
  grossIncome: number;
  monthMap: Map<string, IPropertyReportMonthSummary>;
  netIncome: number;
  propertyExpensesTotal: number;
  salesTypeBreakdown: IPropertyReportSalesTypeBreakdown;
  taxMap: Map<string, IPropertyReportTaxSummaryItem>;
  totalExpenses: number;
}

function mergeSummaryIntoRollup(summary: IPropertyReportSummary, rollup: IRollupAccumulator): void {
  rollup.grossIncome = roundMoney(rollup.grossIncome + summary.totals.grossIncome);
  rollup.netIncome = roundMoney(rollup.netIncome + summary.totals.netIncome);
  rollup.totalExpenses = roundMoney(rollup.totalExpenses + summary.totals.totalExpenses);
  rollup.propertyExpensesTotal = roundMoney(
    rollup.propertyExpensesTotal + summary.propertyExpensesTotal
  );

  rollup.salesTypeBreakdown.room = roundMoney(
    rollup.salesTypeBreakdown.room + summary.salesTypeBreakdown.room
  );
  rollup.salesTypeBreakdown.cleaningFromStays = roundMoney(
    rollup.salesTypeBreakdown.cleaningFromStays + summary.salesTypeBreakdown.cleaningFromStays
  );
  mergeOtherIncomeByType(
    rollup.salesTypeBreakdown.otherIncomeByType,
    summary.salesTypeBreakdown.otherIncomeByType
  );

  for (const row of summary.channelSummary) {
    const existing = rollup.channelMap.get(row.channelCommissionId);
    if (existing) {
      existing.grossIncome = roundMoney(existing.grossIncome + row.grossIncome);
      existing.channelCommission = roundMoney(existing.channelCommission + row.channelCommission);
      existing.stayCount += row.stayCount;
    } else {
      rollup.channelMap.set(row.channelCommissionId, { ...row });
    }
  }

  rollup.byUnit.push(...summary.byUnit);

  for (const row of summary.byMonth) {
    const existing = rollup.monthMap.get(row.month);
    if (existing) {
      existing.grossIncome = roundMoney(existing.grossIncome + row.grossIncome);
      existing.netIncome = roundMoney(existing.netIncome + row.netIncome);
      existing.expenses = roundMoney(existing.expenses + row.expenses);
      existing.operationalNet = roundMoney(existing.operationalNet + row.operationalNet);
    } else {
      rollup.monthMap.set(row.month, { ...row });
    }
  }

  for (const row of summary.expenseByCategory) {
    const existing = rollup.expenseCategoryMap.get(row.categoryId);
    rollup.expenseCategoryMap.set(row.categoryId, {
      amount: roundMoney((existing?.amount ?? 0) + row.amount),
      name: row.name,
    });
  }

  mergeTaxSummary(rollup.taxMap, summary.taxSummary);
}

export function buildPropertyReportSummary(
  data: IReportData,
  query: IPropertyReportsQuery
): IPropertyReportSummary {
  const { expenses, incomeLines, reservations, units } = data;
  const months = listMonthsInRange(query.from, query.to);
  const accumulator: IPropertyReportAccumulator = {
    amenityGrossIncome: 0,
    amenityNetIncome: 0,
    channelMap: new Map<string, IPropertyReportChannelSummary>(),
    expenseCategoryMap: new Map<string, { amount: number; name: string }>(),
    grossIncome: 0,
    monthMap: initMonthMap(months),
    netIncome: 0,
    propertyExpensesTotal: 0,
    salesTypeBreakdown: initSalesBreakdown(),
    taxMap: new Map<string, IPropertyReportTaxSummaryItem>(),
    unitMap: initUnitMap(units, query.from, query.to),
  };

  for (const stay of reservations) {
    applyReservationToReport(stay, query, accumulator);
  }

  for (const line of incomeLines) {
    applyIncomeLineToReport(line, accumulator);
  }

  accumulator.salesTypeBreakdown.otherIncomeByType.sort((a, b) => a.name.localeCompare(b.name));

  for (const expense of expenses) {
    applyExpenseToReport(expense, months, accumulator);
  }

  const byUnit = buildUnitSummaries(
    accumulator.unitMap,
    accumulator.amenityGrossIncome,
    accumulator.amenityNetIncome
  );

  const byMonth: IPropertyReportMonthSummary[] = [...accumulator.monthMap.values()].map(
    (month) => ({
      ...month,
      operationalNet: roundMoney(month.netIncome - month.expenses),
    })
  );

  const channelSummary = [...accumulator.channelMap.values()].filter(
    (entry) => entry.stayCount > 0
  );
  const expenseByCategory: IPropertyReportExpenseCategory[] = [
    ...accumulator.expenseCategoryMap.entries(),
  ]
    .map(([categoryId, { amount, name }]) => ({ amount, categoryId, name }))
    .sort((a, b) => b.amount - a.amount);
  const taxSummary = taxMapToSummary(accumulator.taxMap);
  const totalExpenses = accumulator.propertyExpensesTotal;

  return {
    byMonth,
    byUnit,
    channelSummary,
    expenseByCategory,
    filters: query,
    period: { from: query.from, to: query.to },
    propertyExpensesTotal: accumulator.propertyExpensesTotal,
    salesTypeBreakdown: accumulator.salesTypeBreakdown,
    taxSummary,
    totals: {
      grossIncome: accumulator.grossIncome,
      netIncome: accumulator.netIncome,
      operationalNet: roundMoney(accumulator.netIncome - totalExpenses),
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
    taxSummary: [],
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

  const rollup: IRollupAccumulator = {
    byUnit: [],
    channelMap: new Map<string, IPropertyReportChannelSummary>(),
    expenseCategoryMap: new Map<string, { amount: number; name: string }>(),
    grossIncome: 0,
    monthMap: new Map<string, IPropertyReportMonthSummary>(),
    netIncome: 0,
    propertyExpensesTotal: 0,
    salesTypeBreakdown: initSalesBreakdown(),
    taxMap: new Map<string, IPropertyReportTaxSummaryItem>(),
    totalExpenses: 0,
  };

  for (const summary of summaries) {
    mergeSummaryIntoRollup(summary, rollup);
  }

  const months = listMonthsInRange(query.from, query.to);
  const byMonth = months.map(
    (month) =>
      rollup.monthMap.get(month) ?? {
        expenses: 0,
        grossIncome: 0,
        month,
        netIncome: 0,
        operationalNet: 0,
      }
  );

  const channelSummary = [...rollup.channelMap.values()].sort(
    (a, b) => b.grossIncome - a.grossIncome
  );
  rollup.salesTypeBreakdown.otherIncomeByType.sort((a, b) => a.name.localeCompare(b.name));
  const expenseByCategory: IPropertyReportExpenseCategory[] = [
    ...rollup.expenseCategoryMap.entries(),
  ]
    .map(([categoryId, { amount, name }]) => ({ amount, categoryId, name }))
    .sort((a, b) => b.amount - a.amount);
  const taxSummary = taxMapToSummary(rollup.taxMap);

  return {
    byMonth,
    byUnit: rollup.byUnit,
    channelSummary,
    expenseByCategory,
    filters: query,
    period: { from: query.from, to: query.to },
    propertyExpensesTotal: rollup.propertyExpensesTotal,
    salesTypeBreakdown: rollup.salesTypeBreakdown,
    taxSummary,
    totals: {
      grossIncome: rollup.grossIncome,
      netIncome: rollup.netIncome,
      operationalNet: roundMoney(rollup.netIncome - rollup.totalExpenses),
      totalExpenses: rollup.totalExpenses,
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
  next += csvRow(["Cleaning Fee", summary.salesTypeBreakdown.cleaningFromStays]);
  for (const row of summary.salesTypeBreakdown.otherIncomeByType) {
    next += csvRow([row.name, row.amount]);
  }
  next += "\n";
  next += csvRow(["Channel Summary", "Gross Income", "Commission", "Stays"]);
  for (const row of summary.channelSummary) {
    next += csvRow([row.name, row.grossIncome, row.channelCommission, row.stayCount]);
  }
  next += "\n";
  next += csvRow(["Tax Summary", "Amount"]);
  for (const row of summary.taxSummary) {
    next += csvRow([row.name, row.amount]);
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
    next += csvRow([row.name, row.amount]);
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
