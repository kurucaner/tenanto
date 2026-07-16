import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, KeyRound, Users, Wallet, Wrench } from "lucide-react";
import { memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { QuickActionCard } from "@/components/portal/quick-action-card";
import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { hasOnlinePayAvailable, resolveRentPayAction } from "@/lib/rent-summary-utils";
import { startRentCheckoutForAmountDue } from "@/lib/start-rent-checkout";
import { Button } from "@/packages/app-ui";
import { centsToDollars } from "@/packages/shared";

const COMING_SOON_ACTIONS = [
  { icon: Wrench, label: "Request maintenance" },
  { icon: Users, label: "Community" },
  { icon: FileText, label: "Documents" },
] as const;

function formatUsdFromCents(cents: number, currency: string): string {
  return centsToDollars(cents).toLocaleString(undefined, {
    currency: currency.toUpperCase(),
    style: "currency",
  });
}

function amountDueHint(totalDue: number, onlinePayAvailable: boolean): string {
  if (totalDue === 0) {
    return "You’re all caught up.";
  }
  if (onlinePayAvailable) {
    return "Pay online securely, or open Pay rent below.";
  }
  return "Online payments aren’t available for these leases yet. Open your lease for details.";
}

function primaryDueCtaLabel(isStartingCheckout: boolean, onlinePayAvailable: boolean): string {
  if (isStartingCheckout) {
    return "Starting checkout…";
  }
  return onlinePayAvailable ? "Pay rent" : "View leases";
}

export const HomeDashboardPage = memo(function HomeDashboardPage() {
  const navigate = useNavigate();
  const summaryQuery = useQuery({
    queryFn: () => tenantPortalApi.getRentSummary(),
    queryKey: queryKeys.rentSummary(),
  });

  const checkoutMutation = useMutation({
    mutationFn: startRentCheckoutForAmountDue,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
    },
  });

  const summary = summaryQuery.data;
  const payAction = summary
    ? resolveRentPayAction(summary)
    : { href: "/leases", kind: "navigate" as const };
  const totalDue = summary?.totalAmountDueCents ?? 0;
  const onlinePayAvailable = summary ? hasOnlinePayAvailable(summary.leases) : false;
  const isStartingCheckout = checkoutMutation.isPending;

  const handlePayRent = () => {
    if (payAction.kind === "checkout") {
      checkoutMutation.mutate(payAction.leaseId);
      return;
    }
    navigate(payAction.href);
  };

  const showComingSoon = () => {
    toast.message("Coming soon");
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="space-y-3">
        {summaryQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading balance…</p>
        ) : null}
        {summaryQuery.isError ? (
          <p className="text-sm text-destructive">
            {summaryQuery.error instanceof Error
              ? summaryQuery.error.message
              : "Failed to load rent balance"}
          </p>
        ) : null}
        {summary ? (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Amount due</p>
              <p className="font-display text-4xl font-semibold tracking-tight text-foreground">
                {formatUsdFromCents(totalDue, summary.currency)}
              </p>
              <p className="text-sm text-muted-foreground">
                {amountDueHint(totalDue, onlinePayAvailable)}
              </p>
            </div>
            {totalDue > 0 ? (
              <Button disabled={isStartingCheckout} onClick={handlePayRent} type="button">
                {primaryDueCtaLabel(isStartingCheckout, onlinePayAvailable)}
              </Button>
            ) : (
              <Button asChild type="button" variant="outline">
                <Link to="/leases">View leases</Link>
              </Button>
            )}
          </>
        ) : null}
      </section>

      <section className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Quick actions
          </h1>
          <p className="text-sm text-muted-foreground">Shortcuts for your resident portal.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuickActionCard
            disabled={isStartingCheckout}
            icon={Wallet}
            label={isStartingCheckout ? "Starting…" : "Pay rent"}
            onClick={handlePayRent}
          />
          {COMING_SOON_ACTIONS.map((action) => (
            <QuickActionCard
              icon={action.icon}
              key={action.label}
              label={action.label}
              onClick={showComingSoon}
            />
          ))}
          <QuickActionCard href="/leases" icon={KeyRound} label="Leases" />
        </div>
      </section>
    </div>
  );
});
HomeDashboardPage.displayName = "HomeDashboardPage";
