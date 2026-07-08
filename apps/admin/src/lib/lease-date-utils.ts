function formatLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calculateLeaseEndDate(leaseStartDate: string, termMonths: number): string {
  const [year, month, day] = leaseStartDate.split("-").map(Number);
  const date = new Date(year, month - 1 + termMonths, day);
  return formatLocalIsoDate(date);
}
