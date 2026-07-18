import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink } from "lucide-react";
import { type ComponentProps, memo } from "react";
import { toast } from "sonner";

import { PropertyStripeConnectStatusBadge } from "@/components/settings/property-stripe-connect-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  type TStripeConnectUiStatus,
} from "@/lib/property-stripe-connect-utils";
import { queryKeys } from "@/lib/query-keys";
import {
  type IPropertyStripeConnectStatusResponse,
  PropertyStripeAccountType,
} from "@/packages/shared";

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

function getStripeConnectMutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to start Stripe Connect";
}

function usePropertyStripeConnectMutations(propertyId: string) {
  const queryClient = useQueryClient();

  const expressOnboardingMutation = useMutation({
    mutationFn: () => propertyStripeConnectApi.createExpressOnboardingLink(propertyId),
    onError: (error) => {
      toast.error(getStripeConnectMutationErrorMessage(error));
    },
    onSuccess: (result) => {
      openStripeOnboardingUrl(result.url);
      queryClient.invalidateQueries({
        queryKey: queryKeys.propertyStripeConnectStatus(propertyId),
      });
    },
  });

  const standardOAuthMutation = useMutation({
    mutationFn: () => propertyStripeConnectApi.createStandardOAuthAuthorizeUrl(propertyId),
    onError: (error) => {
      toast.error(getStripeConnectMutationErrorMessage(error));
    },
    onSuccess: (result) => {
      navigateToStripeOAuthUrl(result.url);
    },
  });

  return {
    connectPending: expressOnboardingMutation.isPending || standardOAuthMutation.isPending,
    expressOnboardingMutation,
    standardOAuthMutation,
  };
}

type TStripeConnectOptionProps = {
  disabled: boolean;
  helper: string;
  label: string;
  loadingLabel: string;
  onClick: () => void;
  pending: boolean;
  variant: ComponentProps<typeof Button>["variant"];
};

const StripeConnectOption = memo(function StripeConnectOption({
  disabled,
  helper,
  label,
  loadingLabel,
  onClick,
  pending,
  variant,
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

const StripeConnectStatusDetails = memo(function StripeConnectStatusDetails({
  status,
}: {
  status: IPropertyStripeConnectStatusResponse;
}) {
  return (
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
  );
});
StripeConnectStatusDetails.displayName = "StripeConnectStatusDetails";

type TStripeConnectActionsProps = {
  connectPending: boolean;
  dualOptions: boolean;
  expressPending: boolean;
  onExpressClick: () => void;
  onStandardOAuthClick: () => void;
  showExpressOnboarding: boolean;
  showStandardIncompleteOAuth: boolean;
  showStandardOAuthButton: boolean;
  standardOAuthPending: boolean;
  uiStatus: TStripeConnectUiStatus;
};

const StripeConnectActions = memo(function StripeConnectActions({
  connectPending,
  dualOptions,
  expressPending,
  onExpressClick,
  onStandardOAuthClick,
  showExpressOnboarding,
  showStandardIncompleteOAuth,
  showStandardOAuthButton,
  standardOAuthPending,
  uiStatus,
}: TStripeConnectActionsProps) {
  if (dualOptions) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row">
        <StripeConnectOption
          disabled={connectPending}
          helper={EXPRESS_CONNECT_HELPER}
          label={expressOnboardingButtonLabel(uiStatus)}
          loadingLabel="Opening Stripe…"
          onClick={onExpressClick}
          pending={expressPending}
          variant="default"
        />
        <StripeConnectOption
          disabled={connectPending}
          helper={STANDARD_CONNECT_HELPER}
          label={standardOAuthButtonLabel(uiStatus)}
          loadingLabel="Redirecting to Stripe…"
          onClick={onStandardOAuthClick}
          pending={standardOAuthPending}
          variant="outline"
        />
      </div>
    );
  }

  return (
    <>
      {showExpressOnboarding ? (
        <Button disabled={connectPending} onClick={onExpressClick} type="button">
          {expressPending ? "Opening Stripe…" : expressOnboardingButtonLabel(uiStatus)}
        </Button>
      ) : null}
      {showStandardIncompleteOAuth ? (
        <StripeConnectOption
          disabled={connectPending}
          helper={STANDARD_INCOMPLETE_HELPER}
          label={standardOAuthButtonLabel(uiStatus)}
          loadingLabel="Redirecting to Stripe…"
          onClick={onStandardOAuthClick}
          pending={standardOAuthPending}
          variant="outline"
        />
      ) : null}
      {showStandardOAuthButton ? (
        <Button
          disabled={connectPending}
          onClick={onStandardOAuthClick}
          type="button"
          variant="outline"
        >
          {standardOAuthPending ? "Redirecting to Stripe…" : standardOAuthButtonLabel(uiStatus)}
        </Button>
      ) : null}
    </>
  );
});
StripeConnectActions.displayName = "StripeConnectActions";

const StripeConnectDashboardButton = memo(function StripeConnectDashboardButton() {
  return (
    <Button asChild type="button" variant="outline">
      <a href={STANDARD_STRIPE_DASHBOARD_URL} rel="noopener noreferrer" target="_blank">
        Open Stripe Dashboard
        <ExternalLink className="size-4" />
      </a>
    </Button>
  );
});
StripeConnectDashboardButton.displayName = "StripeConnectDashboardButton";

export const PropertyStripeConnectSection = memo(function PropertyStripeConnectSection({
  propertyId,
  status,
}: {
  propertyId: string;
  status: IPropertyStripeConnectStatusResponse;
}) {
  const { connectPending, expressOnboardingMutation, standardOAuthMutation } =
    usePropertyStripeConnectMutations(propertyId);

  const uiStatus = getStripeConnectUiStatus(status);
  const dualOptions = showDualConnectOptions(status);
  const showExpressOnboarding = shouldShowExpressOnboardingButton(status);
  const showStandardOAuth = shouldShowStandardOAuthButton(status);
  const showStandardDashboard = shouldShowStandardDashboardLink(status);
  const showStandardIncompleteOAuth =
    showStandardOAuth &&
    status.accountType === PropertyStripeAccountType.STANDARD &&
    uiStatus === "setup_incomplete";
  const showStandardOAuthButton = showStandardOAuth && !showStandardIncompleteOAuth;

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
        <StripeConnectStatusDetails status={status} />
        <StripeConnectActions
          connectPending={connectPending}
          dualOptions={dualOptions}
          expressPending={expressOnboardingMutation.isPending}
          onExpressClick={() => expressOnboardingMutation.mutate()}
          onStandardOAuthClick={() => standardOAuthMutation.mutate()}
          showExpressOnboarding={showExpressOnboarding}
          showStandardIncompleteOAuth={showStandardIncompleteOAuth}
          showStandardOAuthButton={showStandardOAuthButton}
          standardOAuthPending={standardOAuthMutation.isPending}
          uiStatus={uiStatus}
        />
        {showStandardDashboard ? <StripeConnectDashboardButton /> : null}
      </CardContent>
    </Card>
  );
});
PropertyStripeConnectSection.displayName = "PropertyStripeConnectSection";
