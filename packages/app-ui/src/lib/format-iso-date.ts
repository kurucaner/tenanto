export function formatIsoDateDisplay(isoDate: string): string {
  const parts = isoDate.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year == null || month == null || day == null) {
    return isoDate;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(year, month - 1, day));
}
