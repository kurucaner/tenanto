function formatLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getTodayLocalIsoDate(): string {
  return formatLocalIsoDate(new Date());
}

export function clampToMaxLocalIsoDate(date: string, maxDate: string): string {
  if (date === "") return "";
  return date > maxDate ? maxDate : date;
}

export function isDateOnOrBefore(date: string, maxDate: string): boolean {
  return date !== "" && date <= maxDate;
}

export function addDaysToLocalIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatLocalIsoDate(date);
}

export function getMinCheckOutDate(checkIn: string): string | undefined {
  if (checkIn === "") return undefined;
  return addDaysToLocalIsoDate(checkIn, 1);
}

export function isValidStayDateRange(checkIn: string, checkOut: string): boolean {
  return checkIn !== "" && checkOut !== "" && checkOut > checkIn;
}

export function shouldClearCheckOutOnCheckInChange(
  nextCheckIn: string,
  currentCheckOut: string
): boolean {
  if (nextCheckIn === "" || currentCheckOut === "") return false;
  return currentCheckOut <= nextCheckIn;
}
