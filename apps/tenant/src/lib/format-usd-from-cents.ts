import { centsToDollars } from "@/packages/shared";

export function formatUsdFromCents(cents: number, currency: string): string {
  return centsToDollars(cents).toLocaleString(undefined, {
    currency: currency.toUpperCase(),
    style: "currency",
  });
}
