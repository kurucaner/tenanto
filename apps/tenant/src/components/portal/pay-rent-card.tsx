import { useMutation } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

import { tenantPortalApi } from "@/lib/api-client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/packages/app-ui";
import {
  centsToDollars,
  dollarsToCents,
  formatLeaseMonthLabel,
  type ITenantLeaseBalancePeriod,
  type ITenantLeaseBalanceResponse,
  STRIPE_MIN_CHARGE_CENTS_USD,
} from "@/packages/shared";

function formatUsdFromCents(cents: number, currency = "usd"): string {
  return centsToDollars(cents).toLocaleString(undefined, {
    currency: currency.toUpperCase(),
    style: "currency",
  });
}

function sumRemainingCents(
  periods: ITenantLeaseBalancePeriod[],
  selectedMonths: ReadonlySet<string>
): number {
  return periods.reduce((sum, period) => {
    if (!selectedMonths.has(period.month) || period.remainingCents <= 0) {
      return sum;
    }
    return sum + period.remainingCents;
  }, 0);
}

function amountDollarsFromCents(cents: number): string {
  return cents > 0 ? String(centsToDollars(cents)) : "";
}

export const PayRentCard = memo(function PayRentCard({
  balance,
  leaseId,
}: {
  balance: ITenantLeaseBalanceResponse;
  leaseId: string;
}) {
  const unpaidPeriods = balance.periods.filter((p) => p.remainingCents > 0);
  const [selectedMonths, setSelectedMonths] = useState(
    () => new Set(unpaidPeriods.map((p) => p.month))
  );
  const maxCents = sumRemainingCents(unpaidPeriods, selectedMonths);
  const [amountDollars, setAmountDollars] = useState(() => amountDollarsFromCents(maxCents));

  const checkoutMutation = useMutation({
    mutationFn: () => {
      const amountCents = dollarsToCents(Number(amountDollars));
      return tenantPortalApi.createRentCheckout(leaseId, {
        amountCents,
        leaseId,
        periodMonths: [...selectedMonths].sort((a, b) => a.localeCompare(b)),
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
    },
    onSuccess: (result) => {
      window.location.assign(result.checkoutUrl);
    },
  });

  const toggleMonth = (month: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      setAmountDollars(amountDollarsFromCents(sumRemainingCents(unpaidPeriods, next)));
      return next;
    });
  };

  if (!balance.paymentsEnabled) {
    return (
      <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Pay rent</CardTitle>
          <CardDescription>
            Online rent payments aren’t available for this property yet. Ask your property manager
            if you need another way to pay.
          </CardDescription>
        </CardHeader>
        {balance.amountDueCents > 0 ? (
          <CardContent>
            <p className="text-sm text-foreground">
              Amount due:{" "}
              <span className="font-medium">
                {formatUsdFromCents(balance.amountDueCents, balance.currency)}
              </span>
            </p>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  if (unpaidPeriods.length === 0) {
    return (
      <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Pay rent</CardTitle>
          <CardDescription>You’re all caught up — nothing is due right now.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const amountCents = dollarsToCents(Number(amountDollars));
  const canPay =
    selectedMonths.size > 0 &&
    Number.isFinite(Number(amountDollars)) &&
    amountCents >= STRIPE_MIN_CHARGE_CENTS_USD &&
    amountCents <= maxCents &&
    !checkoutMutation.isPending;

  return (
    <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-semibold">Pay rent</CardTitle>
        <CardDescription>
          Amount due{" "}
          <span className="font-medium text-foreground">
            {formatUsdFromCents(balance.amountDueCents, balance.currency)}
          </span>
          . Select periods and pay all or part via Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Periods</legend>
          <ul className="divide-y divide-border/80 rounded-lg border border-border/80">
            {unpaidPeriods.map((period) => {
              const id = `period-${period.month}`;
              const checked = selectedMonths.has(period.month);
              return (
                <li className="flex items-center gap-3 px-4 py-3 text-sm" key={period.month}>
                  <input
                    checked={checked}
                    className="size-4 accent-primary"
                    id={id}
                    onChange={() => toggleMonth(period.month)}
                    type="checkbox"
                  />
                  <Label
                    className="flex flex-1 cursor-pointer items-center justify-between gap-3"
                    htmlFor={id}
                  >
                    <span>{formatLeaseMonthLabel(period.month)}</span>
                    <span className="font-medium">
                      {formatUsdFromCents(period.remainingCents, balance.currency)} left
                    </span>
                  </Label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="rent-amount">Amount (USD)</Label>
          <Input
            id="rent-amount"
            inputMode="decimal"
            max={centsToDollars(maxCents)}
            min={centsToDollars(STRIPE_MIN_CHARGE_CENTS_USD)}
            onChange={(event) => setAmountDollars(event.target.value)}
            step="0.01"
            type="number"
            value={amountDollars}
          />
          <p className="text-xs text-muted-foreground">
            Max {formatUsdFromCents(maxCents, balance.currency)} for selected periods. Minimum{" "}
            {formatUsdFromCents(STRIPE_MIN_CHARGE_CENTS_USD, balance.currency)}.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button disabled={!canPay} onClick={() => checkoutMutation.mutate()} type="button">
          {checkoutMutation.isPending ? "Redirecting…" : "Pay with Stripe"}
        </Button>
      </CardFooter>
    </Card>
  );
});
PayRentCard.displayName = "PayRentCard";
