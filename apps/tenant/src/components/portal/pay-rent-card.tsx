import { useMutation } from "@tanstack/react-query";
import { memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PayRentMethodPicker } from "@/components/portal/pay-rent-checkout-picker";
import { formatUsdFromCents } from "@/lib/format-usd-from-cents";
import { isTenantRentPaymentElementEnabled } from "@/lib/stripe-publishable-key";
import { buildTenantRentPayPagePath, startRentPayForAmountDue } from "@/lib/start-rent-checkout";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/packages/app-ui";
import { type ITenantLeaseBalanceResponse } from "@/packages/shared";

export const PayRentCard = memo(function PayRentCard({
  balance,
  leaseId,
}: {
  balance: ITenantLeaseBalanceResponse;
  leaseId: string;
}) {
  const navigate = useNavigate();
  const payMutation = useMutation({
    mutationFn: (paymentMethodFamily: Parameters<typeof startRentPayForAmountDue>[1]) =>
      startRentPayForAmountDue(leaseId, paymentMethodFamily),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to start payment");
    },
    onSuccess: (result) => {
      if (result.kind === "element") {
        void navigate(result.path);
      }
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

  if (isTenantRentPaymentElementEnabled()) {
    return (
      <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Pay rent</CardTitle>
          <CardDescription>
            Pay on this site with your bank account or card. Totals update when you change method.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full" type="button">
            <Link to={buildTenantRentPayPagePath(leaseId)}>Pay rent</Link>
          </Button>
        </CardContent>
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
          isSubmitting={payMutation.isPending}
          onSubmit={(method) => payMutation.mutate(method)}
        />
      </CardContent>
    </Card>
  );
});
PayRentCard.displayName = "PayRentCard";
