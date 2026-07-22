import { memo } from "react";

import type { IPropertyStripeConnectStatusResponse } from "@/packages/shared";

interface StripeConnectTechnicalDetailsProps {
  status: IPropertyStripeConnectStatusResponse;
}

export const StripeConnectTechnicalDetails = memo(function StripeConnectTechnicalDetails({
  status,
}: StripeConnectTechnicalDetailsProps) {
  return (
    <details className="group border-border rounded-lg border px-3 py-2">
      <summary className="text-muted-foreground cursor-pointer text-sm font-medium select-none">
        Technical details
      </summary>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:block sm:space-y-0.5">
          <dt className="text-muted-foreground">Ready to accept payments</dt>
          <dd className="font-medium">{status.chargesEnabled ? "Yes" : "No"}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block sm:space-y-0.5">
          <dt className="text-muted-foreground">Profile complete</dt>
          <dd className="font-medium">{status.detailsSubmitted ? "Yes" : "No"}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block sm:space-y-0.5">
          <dt className="text-muted-foreground">Can receive payouts</dt>
          <dd className="font-medium">{status.payoutsEnabled ? "Yes" : "No"}</dd>
        </div>
        {status.stripeAccountId ? (
          <div className="flex justify-between gap-3 sm:col-span-2 sm:block sm:space-y-0.5">
            <dt className="text-muted-foreground">Account ID</dt>
            <dd className="font-mono text-xs font-medium">{status.stripeAccountId}</dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
});
StripeConnectTechnicalDetails.displayName = "StripeConnectTechnicalDetails";
