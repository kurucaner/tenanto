import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useQuery } from "@tanstack/react-query";
import { memo, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { PayRentMethodPicker } from "@/components/portal/pay-rent-checkout-picker";
import { tenantPortalApi } from "@/lib/api-client";
import { formatUsdFromCents } from "@/lib/format-usd-from-cents";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/packages/app-ui";
import {
  type ITenantCreateRentPaymentIntentResponse,
  type ITenantLeaseBalanceResponse,
  RentPaymentMethodFamily,
  type TRentPaymentMethodFamily,
} from "@/packages/shared";

function resolveDefaultMethod(balance: ITenantLeaseBalanceResponse): TRentPaymentMethodFamily {
  return balance.achPaymentsEnabled
    ? RentPaymentMethodFamily.US_BANK_ACCOUNT
    : RentPaymentMethodFamily.CARD;
}

interface IRentPaymentConfirmFormProps {
  currency: string;
  paymentId: string;
  totalCents: number;
}

const RentPaymentConfirmForm = memo(function RentPaymentConfirmForm({
  currency,
  paymentId,
  totalCents,
}: IRentPaymentConfirmFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setIsConfirming(true);
    const returnUrl = `${globalThis.location.origin}/rent-payments/${encodeURIComponent(paymentId)}?status=success`;
    const { error } = await stripe.confirmPayment({
      confirmParams: { return_url: returnUrl },
      elements,
    });

    if (error) {
      toast.error(error.message ?? "Payment could not be completed");
      setIsConfirming(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: "tabs" }} />
      <Button disabled={!stripe || !elements || isConfirming} type="submit">
        {isConfirming
          ? "Processing…"
          : `Pay ${formatUsdFromCents(totalCents, currency)}`}
      </Button>
    </form>
  );
});
RentPaymentConfirmForm.displayName = "RentPaymentConfirmForm";

interface IRentPaymentElementCheckoutProps {
  balance: ITenantLeaseBalanceResponse;
  initialMethod?: TRentPaymentMethodFamily;
  leaseId: string;
  renderElements: (intent: ITenantCreateRentPaymentIntentResponse) => ReactNode;
}

export const RentPaymentElementCheckout = memo(function RentPaymentElementCheckout({
  balance,
  initialMethod,
  leaseId,
  renderElements,
}: IRentPaymentElementCheckoutProps) {
  const [selectedMethod, setSelectedMethod] = useState<TRentPaymentMethodFamily>(() =>
    initialMethod ?? resolveDefaultMethod(balance)
  );

  useEffect(() => {
    if (initialMethod != null) {
      setSelectedMethod(initialMethod);
    }
  }, [initialMethod]);

  const intentQuery = useQuery({
    enabled: balance.amountDueCents > 0,
    queryFn: () =>
      tenantPortalApi.createRentPaymentIntent(leaseId, {
        paymentMethodFamily: selectedMethod,
      }),
    queryKey: queryKeys.rentPaymentIntent(leaseId, selectedMethod),
  });

  return (
    <div className="flex flex-col gap-6">
      <PayRentMethodPicker
        balance={balance}
        isSubmitting={intentQuery.isFetching}
        mode="element"
        onMethodChange={setSelectedMethod}
        selectedMethod={selectedMethod}
      />

      {intentQuery.isPending || intentQuery.isFetching ? (
        <p className="text-sm text-muted-foreground">Preparing secure payment…</p>
      ) : null}

      {intentQuery.isError ? (
        <p className="text-sm text-destructive">
          {intentQuery.error instanceof Error
            ? intentQuery.error.message
            : "Failed to prepare payment"}
        </p>
      ) : null}

      {intentQuery.data ? renderElements(intentQuery.data) : null}
    </div>
  );
});
RentPaymentElementCheckout.displayName = "RentPaymentElementCheckout";

export { RentPaymentConfirmForm };
