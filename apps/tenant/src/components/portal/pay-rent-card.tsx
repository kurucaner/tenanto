import { useMutation } from "@tanstack/react-query";
import { memo } from "react";
import { toast } from "sonner";

import { startRentCheckoutForAmountDue } from "@/lib/start-rent-checkout";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/packages/app-ui";
import { centsToDollars, type ITenantLeaseBalanceResponse } from "@/packages/shared";

function formatUsdFromCents(cents: number, currency = "usd"): string {
  return centsToDollars(cents).toLocaleString(undefined, {
    currency: currency.toUpperCase(),
    style: "currency",
  });
}

export const PayRentCard = memo(function PayRentCard({
  balance,
  leaseId,
}: {
  balance: ITenantLeaseBalanceResponse;
  leaseId: string;
}) {
  const checkoutMutation = useMutation({
    mutationFn: () => startRentCheckoutForAmountDue(leaseId),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
    },
  });

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

  if (balance.amountDueCents <= 0) {
    return (
      <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Pay rent</CardTitle>
          <CardDescription>You’re all caught up — nothing is due right now.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-semibold">Pay rent</CardTitle>
        <CardDescription>
          Amount due{" "}
          <span className="font-medium text-foreground">
            {formatUsdFromCents(balance.amountDueCents, balance.currency)}
          </span>
          . Pay securely with Stripe.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          disabled={checkoutMutation.isPending}
          onClick={() => checkoutMutation.mutate()}
          type="button"
        >
          {checkoutMutation.isPending ? "Redirecting…" : "Pay rent"}
        </Button>
      </CardFooter>
    </Card>
  );
});
PayRentCard.displayName = "PayRentCard";
