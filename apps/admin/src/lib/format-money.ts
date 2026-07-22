/** Whole dollars as `$1,750`; any cents as `$1,750.01`. */
export function formatMoney(value: number): string {
  const hasCents = Math.round(value * 100) % 100 !== 0;
  const fractionDigits = hasCents ? 2 : 0;

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: "currency",
  }).format(value);
}
