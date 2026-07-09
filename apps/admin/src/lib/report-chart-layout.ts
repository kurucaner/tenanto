const EXPENSE_ROW_HEIGHT_PX = 36;
const EXPENSE_CHART_MIN_HEIGHT_PX = 280;
const EXPENSE_CHART_MAX_HEIGHT_PX = 560;

export function getExpenseBreakdownChartHeight(categoryCount: number): number {
  return Math.min(
    EXPENSE_CHART_MAX_HEIGHT_PX,
    Math.max(EXPENSE_CHART_MIN_HEIGHT_PX, categoryCount * EXPENSE_ROW_HEIGHT_PX)
  );
}

export function getExpenseBreakdownScrollMaxHeight(): number {
  return EXPENSE_CHART_MAX_HEIGHT_PX;
}
