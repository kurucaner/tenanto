export function formatLeaseMonthLabel(month: string): string {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthNum = parts[1] ?? 1;
  return new Date(year, monthNum - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
