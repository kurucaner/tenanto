import { useMutation } from "@tanstack/react-query";
import { memo } from "react";
import { toast } from "sonner";

import { PayRentMethodPicker } from "@/components/portal/pay-rent-checkout-picker";
import { formatUsdFromCents } from "@/lib/format-usd-from-cents";
import { startRentCheckoutForAmountDue } from "@/lib/start-rent-checkout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/packages/app-ui";
import { type ITenantLeaseBalanceResponse } from "@/packages/shared";

export const PayRentCard = memo(function PayRentCard({
  balance,
  leaseId,
}: {
  balance: ITenantLeaseBalanceResponse;
  leaseId: string;
}) {
  const checkoutMutation = useMutation({
    mutationFn: (paymentMethodFamily: Parameters<typeof startRentCheckoutForAmountDue>[1]) =>
      startRentCheckoutForAmountDue(leaseId, paymentMethodFamily),
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
          Choose a payment method below. You&apos;ll review the total before checkout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PayRentMethodPicker
          balance={balance}
          isSubmitting={checkoutMutation.isPending}
          onSubmit={(method) => checkoutMutation.mutate(method)}
        />
      </CardContent>
    </Card>
  );
});
PayRentCard.displayName = "PayRentCard";
