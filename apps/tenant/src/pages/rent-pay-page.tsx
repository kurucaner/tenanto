import { Elements } from "@stripe/react-stripe-js";
import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";

import {
  RentPaymentConfirmForm,
  RentPaymentElementCheckout,
} from "@/components/portal/rent-payment-element-form";
import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { parseTenantRentPayMethodParam } from "@/lib/start-rent-checkout";
import {
  getStripePromise,
  isTenantRentPaymentElementEnabled,
  requireStripePublishableKey,
} from "@/lib/stripe-publishable-key";
import { Button } from "@/packages/app-ui";

export const RentPayPage = memo(function RentPayPage() {
  const { leaseId = "" } = useParams<{ leaseId: string }>();
  const [searchParams] = useSearchParams();
  const initialMethod = parseTenantRentPayMethodParam(searchParams.get("method"));

  const balanceQuery = useQuery({
    enabled: leaseId.length > 0,
    queryFn: () => tenantPortalApi.getLeaseBalance(leaseId),
    queryKey: queryKeys.leaseBalance(leaseId),
  });

  if (!isTenantRentPaymentElementEnabled()) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Pay rent
        </h1>
        <p className="text-sm text-destructive">
          Online card and bank payments are not configured for this portal yet. Ask your property
          manager for another way to pay, or try again later.
        </p>
        {leaseId ? (
          <Button asChild type="button" variant="outline">
            <Link to={`/leases/${leaseId}`}>Back to lease</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  requireStripePublishableKey();

  if (balanceQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading amount due…</p>;
  }

  if (balanceQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Pay rent
        </h1>
        <p className="text-sm text-destructive">
          {balanceQuery.error instanceof Error
            ? balanceQuery.error.message
            : "Failed to load balance"}
        </p>
        <Button asChild type="button" variant="outline">
          <Link to={`/leases/${leaseId}`}>Back to lease</Link>
        </Button>
      </div>
    );
  }

  const balance = balanceQuery.data;
  if (!balance.paymentsEnabled || balance.amountDueCents <= 0) {
    return <Navigate replace to={`/leases/${leaseId}`} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Pay rent
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a payment method and complete payment on this page. Totals update when you switch
          between bank transfer and card.
        </p>
      </div>

      <RentPaymentElementCheckout
        balance={balance}
        initialMethod={initialMethod}
        leaseId={leaseId}
        renderElements={(intent) => (
          <Elements
            key={intent.clientSecret}
            options={{ clientSecret: intent.clientSecret }}
            stripe={getStripePromise()}
          >
            <RentPaymentConfirmForm
              currency={balance.currency}
              paymentId={intent.paymentId}
              totalCents={intent.chargeCents}
            />
          </Elements>
        )}
      />

      <Button asChild type="button" variant="ghost">
        <Link to={`/leases/${leaseId}`}>Cancel</Link>
      </Button>
    </div>
  );
});
RentPayPage.displayName = "RentPayPage";
