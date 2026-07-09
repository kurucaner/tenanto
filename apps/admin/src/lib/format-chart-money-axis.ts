export function formatChartMoneyAxis(value: number): string {
  if (value >= 1000 || value <= -1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return `$${value}`;
}
