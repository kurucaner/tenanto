import { useMutation, useQuery } from "@tanstack/react-query";
import { memo, useEffect, useState } from "react";
import { toast } from "sonner";

import { tenantPortalApi } from "@/lib/api-client";
import { formatUsdFromCents } from "@/lib/format-usd-from-cents";
import { queryKeys } from "@/lib/query-keys";
import { startRentCheckoutForAmountDue } from "@/lib/start-rent-checkout";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/packages/app-ui";
import {
  computeRentCardConvenienceFeeCents,
  computeRentCheckoutChargeCents,
  type ITenantLeaseBalanceResponse,
  RentPaymentMethodFamily,
  type TRentPaymentMethodFamily,
} from "@/packages/shared";

const CARD_CONVENIENCE_FEE_DISCLOSURE =
  "A convenience fee applies when you pay by card. This fee is charged by the platform, not your property manager.";

function resolveDefaultMethod(balance: ITenantLeaseBalanceResponse): TRentPaymentMethodFamily {
  return balance.achPaymentsEnabled
    ? RentPaymentMethodFamily.US_BANK_ACCOUNT
    : RentPaymentMethodFamily.CARD;
}

function methodLabel(method: TRentPaymentMethodFamily): string {
  return method === RentPaymentMethodFamily.CARD ? "Debit or credit card" : "Bank account (ACH)";
}

interface IPayRentMethodPickerProps {
  balance: ITenantLeaseBalanceResponse;
  isSubmitting: boolean;
  onSubmit: (paymentMethodFamily: TRentPaymentMethodFamily) => void;
}

export const PayRentMethodPicker = memo(function PayRentMethodPicker({
  balance,
  isSubmitting,
  onSubmit,
}: IPayRentMethodPickerProps) {
  const [selectedMethod, setSelectedMethod] = useState<TRentPaymentMethodFamily>(() =>
    resolveDefaultMethod(balance)
  );

  useEffect(() => {
    setSelectedMethod(resolveDefaultMethod(balance));
  }, [balance]);

  const feeCents =
    selectedMethod === RentPaymentMethodFamily.CARD
      ? computeRentCardConvenienceFeeCents(balance.amountDueCents)
      : 0;
  const chargeCents = computeRentCheckoutChargeCents(balance.amountDueCents, selectedMethod);
  const availableMethods: TRentPaymentMethodFamily[] = balance.achPaymentsEnabled
    ? [RentPaymentMethodFamily.US_BANK_ACCOUNT, RentPaymentMethodFamily.CARD]
    : [RentPaymentMethodFamily.CARD];

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Payment method</p>
        <div className="flex flex-col gap-2">
          {availableMethods.map((method) => {
            const methodChargeCents = computeRentCheckoutChargeCents(
              balance.amountDueCents,
              method
            );
            const isSelected = selectedMethod === method;
            return (
              <button
                aria-pressed={isSelected}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border/80 bg-card/85 hover:bg-muted/40"
                }`}
                key={method}
                onClick={() => setSelectedMethod(method)}
                type="button"
              >
                <span className="block text-sm font-medium text-foreground">
                  {methodLabel(method)}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Total {formatUsdFromCents(methodChargeCents, balance.currency)}
                  {method === RentPaymentMethodFamily.US_BANK_ACCOUNT ? " · no fee" : ""}
                </span>
              </button>
            );
          })}
        </div>
        {!balance.achPaymentsEnabled ? (
          <p className="text-xs text-muted-foreground">
            Bank transfer is not available for this property yet. Pay by card to continue online.
          </p>
        ) : null}
      </div>

      <dl className="space-y-2 rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Rent due</dt>
          <dd className="font-medium text-foreground">
            {formatUsdFromCents(balance.amountDueCents, balance.currency)}
          </dd>
        </div>
        {feeCents > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Card convenience fee</dt>
            <dd className="font-medium text-foreground">
              {formatUsdFromCents(feeCents, balance.currency)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-border/60 pt-2">
          <dt className="font-medium text-foreground">Total</dt>
          <dd className="font-semibold text-foreground">
            {formatUsdFromCents(chargeCents, balance.currency)}
          </dd>
        </div>
      </dl>

      {selectedMethod === RentPaymentMethodFamily.CARD ? (
        <p className="text-xs text-muted-foreground">{CARD_CONVENIENCE_FEE_DISCLOSURE}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          ACH bank transfers usually take a few business days to settle. You&apos;ll see a
          processing status until the payment clears.
        </p>
      )}

      <Button disabled={isSubmitting} onClick={() => onSubmit(selectedMethod)} type="button">
        {isSubmitting ? "Redirecting…" : "Continue to payment"}
      </Button>
    </div>
  );
});
PayRentMethodPicker.displayName = "PayRentMethodPicker";

interface IPayRentCheckoutSheetProps {
  disabled?: boolean;
  leaseId: string;
  triggerClassName?: string;
  triggerLabel?: string;
}

export const PayRentCheckoutSheet = memo(function PayRentCheckoutSheet({
  disabled = false,
  leaseId,
  triggerClassName,
  triggerLabel = "Pay rent",
}: IPayRentCheckoutSheetProps) {
  const [open, setOpen] = useState(false);
  const balanceQuery = useQuery({
    enabled: open,
    queryFn: () => tenantPortalApi.getLeaseBalance(leaseId),
    queryKey: queryKeys.leaseBalance(leaseId),
  });
  const checkoutMutation = useMutation({
    mutationFn: (paymentMethodFamily: TRentPaymentMethodFamily) =>
      startRentCheckoutForAmountDue(leaseId, paymentMethodFamily),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
    },
  });

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          className={triggerClassName}
          disabled={disabled || checkoutMutation.isPending}
          type="button"
        >
          {checkoutMutation.isPending ? "Redirecting…" : triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto" side="bottom">
        <SheetHeader>
          <SheetTitle>Pay rent</SheetTitle>
          <SheetDescription>
            Choose how you want to pay. Amounts are locked before checkout.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {balanceQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading amount due…</p>
          ) : null}
          {balanceQuery.isError ? (
            <p className="text-sm text-destructive">
              {balanceQuery.error instanceof Error
                ? balanceQuery.error.message
                : "Failed to load balance"}
            </p>
          ) : null}
          {balanceQuery.data && balanceQuery.data.amountDueCents > 0 ? (
            <PayRentMethodPicker
              balance={balanceQuery.data}
              isSubmitting={checkoutMutation.isPending}
              onSubmit={(method) => checkoutMutation.mutate(method)}
            />
          ) : null}
          {balanceQuery.data && balanceQuery.data.amountDueCents <= 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is due right now.</p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
});
PayRentCheckoutSheet.displayName = "PayRentCheckoutSheet";

export { CARD_CONVENIENCE_FEE_DISCLOSURE };
