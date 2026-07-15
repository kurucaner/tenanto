export function formatRateLimitWindow(windowMs: number): string {
  const totalMinutes = Math.max(1, Math.round(windowMs / 60_000));

  if (totalMinutes >= 60 && totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;
    const minuteLabel = minutes === 1 ? "1 minute" : `${minutes} minutes`;
    return `${hourLabel} ${minuteLabel}`;
  }

  return totalMinutes === 1 ? "1 minute" : `${totalMinutes} minutes`;
}

export function formatRateLimitRetryAfter(retryAfterSec: number): string {
  const safeRetryAfterSec = Math.max(1, Math.ceil(retryAfterSec));

  if (safeRetryAfterSec >= 3600 && safeRetryAfterSec % 3600 === 0) {
    const hours = safeRetryAfterSec / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  if (safeRetryAfterSec >= 120) {
    const minutes = Math.ceil(safeRetryAfterSec / 60);
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }

  return safeRetryAfterSec === 1 ? "1 second" : `${safeRetryAfterSec} seconds`;
}
