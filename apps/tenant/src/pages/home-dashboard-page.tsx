import { useQuery } from "@tanstack/react-query";
import { FileText, KeyRound, Users, Wrench } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { LeaseDueRow } from "@/components/portal/lease-due-row";
import { PayRentCheckoutSheet } from "@/components/portal/pay-rent-checkout-picker";
import { QuickActionCard } from "@/components/portal/quick-action-card";
import { tenantPortalApi } from "@/lib/api-client";
import { formatUsdFromCents } from "@/lib/format-usd-from-cents";
import { queryKeys } from "@/lib/query-keys";
import {
  formatDuePeriodsLabel,
  hasOnlinePayAvailable,
  resolveRentPayAction,
} from "@/lib/rent-summary-utils";
import { Button } from "@/packages/app-ui";
import { type ITenantRentSummaryResponse } from "@/packages/shared";

const COMING_SOON_ACTIONS = [
  { icon: Wrench, label: "Request maintenance" },
  { icon: Users, label: "Community" },
  { icon: FileText, label: "Documents" },
] as const;

function amountDueHint(totalDue: number, onlinePayAvailable: boolean): string {
  if (totalDue === 0) {
    return "You&apos;re all caught up.";
  }
  if (onlinePayAvailable) {
    return "Choose a payment method to pay online securely.";
  }
  return "Online payments aren't available for these leases yet. Open your lease for details.";
}

function multiLeaseAmountDueHint(totalDue: number, onlinePayAvailable: boolean): string {
  if (totalDue === 0) {
    return "Nothing is due across your active leases right now.";
  }
  if (onlinePayAvailable) {
    return "Choose a lease below to pick a payment method.";
  }
  return "Online payments aren't available for some leases yet. Open a lease for details.";
}

interface NoActiveLeaseSectionProps {
  hasPastLeases: boolean;
}

function NoActiveLeaseSection({ hasPastLeases }: Readonly<NoActiveLeaseSectionProps>) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          No active lease
        </h1>
        <p className="text-sm text-muted-foreground">
          You don’t have an active lease on this account.
          {hasPastLeases ? " You can still open past leases to review details." : null}
        </p>
      </div>
      <Button asChild type="button" variant="outline">
        <Link to="/leases">{hasPastLeases ? "View past leases" : "View leases"}</Link>
      </Button>
    </section>
  );
}

interface SingleLeaseDueSectionProps {
  currency: string;
  duePeriodsLabel: string | null;
  onlinePayAvailable: boolean;
  payAction: ReturnType<typeof resolveRentPayAction>;
  totalDue: number;
}

const SingleLeaseDueSection = memo(function SingleLeaseDueSection({
  currency,
  duePeriodsLabel,
  onlinePayAvailable,
  payAction,
  totalDue,
}: SingleLeaseDueSectionProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Amount due</p>
        <p className="font-display text-4xl font-semibold tracking-tight text-foreground">
          {formatUsdFromCents(totalDue, currency)}
        </p>
        {duePeriodsLabel ? (
          <p className="text-sm text-muted-foreground">Due: {duePeriodsLabel}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {amountDueHint(totalDue, onlinePayAvailable)}
        </p>
      </div>
      {totalDue > 0 && payAction.kind === "checkout" ? (
        <PayRentCheckoutSheet leaseId={payAction.leaseId} triggerLabel="Pay rent" />
      ) : null}
      {totalDue > 0 && payAction.kind === "navigate" ? (
        <Button asChild type="button">
          <Link to={payAction.href}>View lease</Link>
        </Button>
      ) : null}
      {totalDue === 0 ? (
        <Button asChild type="button" variant="outline">
          <Link to="/leases">View leases</Link>
        </Button>
      ) : null}
    </section>
  );
});
SingleLeaseDueSection.displayName = "SingleLeaseDueSection";

interface MultiLeaseDueSectionProps {
  currency: string;
  leases: ITenantRentSummaryResponse["leases"];
  onlinePayAvailable: boolean;
  totalDue: number;
}

const MultiLeaseDueSection = memo(function MultiLeaseDueSection({
  currency,
  leases,
  onlinePayAvailable,
  totalDue,
}: MultiLeaseDueSectionProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Your leases
        </h1>
        {totalDue > 0 ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">Total due</p>
            <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {formatUsdFromCents(totalDue, currency)}
            </p>
          </>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {multiLeaseAmountDueHint(totalDue, onlinePayAvailable)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {leases.map((lease) => (
          <LeaseDueRow currency={currency} key={lease.leaseId} lease={lease} variant="inline" />
        ))}
      </div>

      {totalDue === 0 ? (
        <Button asChild type="button" variant="outline">
          <Link to="/leases">View leases</Link>
        </Button>
      ) : null}
    </section>
  );
});
MultiLeaseDueSection.displayName = "MultiLeaseDueSection";

export const HomeDashboardPage = memo(function HomeDashboardPage() {
  const summaryQuery = useQuery({
    queryFn: () => tenantPortalApi.getRentSummary(),
    queryKey: queryKeys.rentSummary(),
  });

  const summary = summaryQuery.data;
  const payAction = summary
    ? resolveRentPayAction(summary)
    : { href: "/leases", kind: "navigate" as const };
  const totalDue = summary?.totalAmountDueCents ?? 0;
  const onlinePayAvailable = summary ? hasOnlinePayAvailable(summary.leases) : false;
  const hasActiveLease = summary?.hasActiveLease ?? false;
  const isMultiLease = (summary?.leases.length ?? 0) > 1;

  const showComingSoon = () => {
    toast.message("Coming soon");
  };

  return (
    <div className="flex flex-col gap-8">
      {summaryQuery.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {summaryQuery.isError ? (
        <p className="text-sm text-destructive">
          {summaryQuery.error instanceof Error
            ? summaryQuery.error.message
            : "Failed to load portal summary"}
        </p>
      ) : null}

      {summary && !hasActiveLease ? (
        <NoActiveLeaseSection hasPastLeases={summary.hasPastLeases} />
      ) : null}

      {summary && hasActiveLease ? (
        <>
          {isMultiLease ? (
            <MultiLeaseDueSection
              currency={summary.currency}
              leases={summary.leases}
              onlinePayAvailable={onlinePayAvailable}
              totalDue={totalDue}
            />
          ) : (
            <SingleLeaseDueSection
              currency={summary.currency}
              duePeriodsLabel={formatDuePeriodsLabel(summary.leases[0]?.duePeriodKeys ?? [])}
              onlinePayAvailable={onlinePayAvailable}
              payAction={payAction}
              totalDue={totalDue}
            />
          )}

          <section className="flex flex-col gap-6">
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                Quick actions
              </h1>
              <p className="text-sm text-muted-foreground">Shortcuts for your resident portal.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        </>
      ) : null}
    </div>
  );
});
HomeDashboardPage.displayName = "HomeDashboardPage";
