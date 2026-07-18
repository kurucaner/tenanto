import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink } from "lucide-react";
import { type ComponentProps, memo } from "react";
import { toast } from "sonner";

import { PropertyStripeConnectStatusBadge } from "@/components/settings/property-stripe-connect-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { propertyStripeConnectApi } from "@/lib/api-client";
import {
  EXPRESS_CONNECT_HELPER,
  expressOnboardingButtonLabel,
  getStripeConnectUiStatus,
  shouldShowExpressOnboardingButton,
  shouldShowStandardDashboardLink,
  shouldShowStandardOAuthButton,
  showDualConnectOptions,
  STANDARD_CONNECT_HELPER,
  STANDARD_INCOMPLETE_HELPER,
  STANDARD_STRIPE_DASHBOARD_URL,
  standardOAuthButtonLabel,
  stripeConnectSectionDescription,
} from "@/lib/property-stripe-connect-utils";
import { queryKeys } from "@/lib/query-keys";
import { PropertyStripeAccountType } from "@/packages/shared";

function openStripeOnboardingUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function navigateToStripeOAuthUrl(url: string): void {
  window.location.assign(url);
}

type TStripeConnectOptionProps = {
  disabled: boolean;
  helper: string;
  label: string;
  loadingLabel: string;
  onClick: () => void;
  pending: boolean;
  variant?: ComponentProps<typeof Button>["variant"];
};

const StripeConnectOption = memo(function StripeConnectOption({
  disabled,
  helper,
  label,
  loadingLabel,
  onClick,
  pending,
  variant = "default",
}: TStripeConnectOptionProps) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Button disabled={disabled} onClick={onClick} type="button" variant={variant}>
        {pending ? loadingLabel : label}
      </Button>
      <p className="text-muted-foreground text-sm">{helper}</p>
    </div>
  );
});
StripeConnectOption.displayName = "StripeConnectOption";

export const PropertyStripeConnectSection = memo(function PropertyStripeConnectSection({
  propertyId,
}: {
  propertyId: string;
}) {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryFn: () => propertyStripeConnectApi.getStatus(propertyId),
    queryKey: queryKeys.propertyStripeConnectStatus(propertyId),
  });

  const expressOnboardingMutation = useMutation({
    mutationFn: () => propertyStripeConnectApi.createExpressOnboardingLink(propertyId),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to start Stripe Connect");
    },
    onSuccess: (result) => {
      openStripeOnboardingUrl(result.url);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.propertyStripeConnectStatus(propertyId),
      });
    },
  });

  const standardOAuthMutation = useMutation({
    mutationFn: () => propertyStripeConnectApi.createStandardOAuthAuthorizeUrl(propertyId),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to start Stripe Connect");
    },
    onSuccess: (result) => {
      navigateToStripeOAuthUrl(result.url);
    },
  });

  if (statusQuery.isPending) {
    return (
      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Rent payments (Stripe)</CardTitle>
          <CardDescription>
            {statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "Failed to load Stripe Connect status"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const status = statusQuery.data;
  const uiStatus = getStripeConnectUiStatus(status);
  const dualOptions = showDualConnectOptions(status);
  const showExpressOnboarding = shouldShowExpressOnboardingButton(status);
  const showStandardOAuth = shouldShowStandardOAuthButton(status);
  const showStandardDashboard = shouldShowStandardDashboardLink(status);
  const connectPending = expressOnboardingMutation.isPending || standardOAuthMutation.isPending;

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CreditCard className="text-muted-foreground size-4" />
          <CardTitle className="text-lg">Rent payments (Stripe)</CardTitle>
          <PropertyStripeConnectStatusBadge status={status} />
        </div>
        <CardDescription>{stripeConnectSectionDescription(status, uiStatus)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 sm:block sm:space-y-0.5">
            <dt className="text-muted-foreground">Charges enabled</dt>
            <dd className="font-medium">{status.chargesEnabled ? "Yes" : "No"}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block sm:space-y-0.5">
            <dt className="text-muted-foreground">Details submitted</dt>
            <dd className="font-medium">{status.detailsSubmitted ? "Yes" : "No"}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block sm:space-y-0.5">
            <dt className="text-muted-foreground">Payouts enabled</dt>
            <dd className="font-medium">{status.payoutsEnabled ? "Yes" : "No"}</dd>
          </div>
          {status.stripeAccountId ? (
            <div className="flex justify-between gap-3 sm:block sm:space-y-0.5 sm:col-span-2">
              <dt className="text-muted-foreground">Account</dt>
              <dd className="font-mono text-xs font-medium">{status.stripeAccountId}</dd>
            </div>
          ) : null}
        </dl>

        {dualOptions ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            <StripeConnectOption
              disabled={connectPending}
              helper={EXPRESS_CONNECT_HELPER}
              label={expressOnboardingButtonLabel(uiStatus)}
              loadingLabel="Opening Stripe…"
              onClick={() => expressOnboardingMutation.mutate()}
              pending={expressOnboardingMutation.isPending}
            />
            <StripeConnectOption
              disabled={connectPending}
              helper={STANDARD_CONNECT_HELPER}
              label={standardOAuthButtonLabel(uiStatus)}
              loadingLabel="Redirecting to Stripe…"
              onClick={() => standardOAuthMutation.mutate()}
              pending={standardOAuthMutation.isPending}
              variant="outline"
            />
          </div>
        ) : (
          <>
            {showExpressOnboarding ? (
              <Button
                disabled={connectPending}
                onClick={() => expressOnboardingMutation.mutate()}
                type="button"
              >
                {expressOnboardingMutation.isPending
                  ? "Opening Stripe…"
                  : expressOnboardingButtonLabel(uiStatus)}
              </Button>
            ) : null}
            {showStandardOAuth ? (
              status.accountType === PropertyStripeAccountType.STANDARD &&
              uiStatus === "setup_incomplete" ? (
                <StripeConnectOption
                  disabled={connectPending}
                  helper={STANDARD_INCOMPLETE_HELPER}
                  label={standardOAuthButtonLabel(uiStatus)}
                  loadingLabel="Redirecting to Stripe…"
                  onClick={() => standardOAuthMutation.mutate()}
                  pending={standardOAuthMutation.isPending}
                  variant="outline"
                />
              ) : (
                <Button
                  disabled={connectPending}
                  onClick={() => standardOAuthMutation.mutate()}
                  type="button"
                  variant="outline"
                >
                  {standardOAuthMutation.isPending
                    ? "Redirecting to Stripe…"
                    : standardOAuthButtonLabel(uiStatus)}
                </Button>
              )
            ) : null}
          </>
        )}

        {showStandardDashboard ? (
          <Button asChild type="button" variant="outline">
            <a href={STANDARD_STRIPE_DASHBOARD_URL} rel="noopener noreferrer" target="_blank">
              Open Stripe Dashboard
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
});
PropertyStripeConnectSection.displayName = "PropertyStripeConnectSection";
