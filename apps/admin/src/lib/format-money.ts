function formatUsd(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: "currency",
  }).format(value);
}

export function formatMoney(value: number): string {
  return formatUsd(value, 2);
}

/** Whole dollars as `$1,750`; any cents as `$1,750.01`. */
export function formatMoneyOptionalCents(value: number): string {
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return formatUsd(value, hasCents ? 2 : 0);
}
