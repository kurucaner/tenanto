import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  isTerminalTenantRentPaymentStatus,
  TenantRentPaymentStatus,
  type TTenantRentPaymentStatus,
} from "@/packages/shared";

const POLL_INTERVAL_MS = 2000;

function statusHeading(
  status: TTenantRentPaymentStatus | undefined,
  returnHint: string | null
): { subtitle: string; title: string } {
  if (status === TenantRentPaymentStatus.SUCCEEDED) {
    return {
      subtitle: "Your rent payment was confirmed. Thank you.",
      title: "Payment successful",
    };
  }
  if (status === TenantRentPaymentStatus.FAILED) {
    return {
      subtitle: "The charge did not go through. You can try again from your lease.",
      title: "Payment failed",
    };
  }
  if (status === TenantRentPaymentStatus.CANCELED || returnHint === "cancel") {
    return {
      subtitle: "No charge was completed. You can start again anytime from your lease.",
      title: "Payment canceled",
    };
  }
  if (status === TenantRentPaymentStatus.REFUNDED) {
    return {
      subtitle: "This payment was refunded.",
      title: "Payment refunded",
    };
  }
  return {
    subtitle:
      "We’re confirming with your bank and property manager. This page updates automatically.",
    title: "Confirming payment…",
  };
}

export const RentPaymentReturnPage = memo(function RentPaymentReturnPage() {
  const { paymentId = "" } = useParams<{ paymentId: string }>();
  const [searchParams] = useSearchParams();
  const returnHint = searchParams.get("status");

  const paymentQuery = useQuery({
    enabled: paymentId.length > 0,
    queryFn: () => tenantPortalApi.getRentPayment(paymentId),
    queryKey: queryKeys.rentPayment(paymentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && isTerminalTenantRentPaymentStatus(status)) {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
  });

  const status = paymentQuery.data?.status;
  const { subtitle, title } = statusHeading(status, returnHint);
  const leaseId = paymentQuery.data?.leaseId;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {paymentQuery.isError ? (
        <p className="text-sm text-destructive">
          We couldn’t load this payment. Check that you’re signed in with the account that paid.
        </p>
      ) : null}

      {paymentQuery.data ? (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium text-foreground">{paymentQuery.data.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="font-medium text-foreground">
              {(paymentQuery.data.amountCents / 100).toLocaleString(undefined, {
                currency: paymentQuery.data.currency.toUpperCase(),
                style: "currency",
              })}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        {leaseId ? (
          <Link
            className="text-primary underline-offset-4 hover:underline"
            to={`/leases/${leaseId}`}
          >
            Back to lease
          </Link>
        ) : null}
        <Link className="text-primary underline-offset-4 hover:underline" to="/home">
          Home
        </Link>
      </div>
    </div>
  );
});
RentPaymentReturnPage.displayName = "RentPaymentReturnPage";
