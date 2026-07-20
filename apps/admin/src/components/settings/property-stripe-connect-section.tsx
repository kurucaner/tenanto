import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Link2, Sparkles, Wallet } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { StripeConnectChoiceCard } from "@/components/settings/property-stripe-connect-choice-card";
import { StripeConnectProgressSteps } from "@/components/settings/property-stripe-connect-progress-steps";
import { PropertyStripeConnectStatusBadge } from "@/components/settings/property-stripe-connect-status-badge";
import { StripeConnectTechnicalDetails } from "@/components/settings/property-stripe-connect-technical-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { propertyStripeConnectApi } from "@/lib/api-client";
import {
  expressOnboardingButtonLabel,
  getStripeConnectUiStatus,
  isStripeConnectTypeSwitch,
  shouldShowStandardDashboardLink,
  shouldShowStandardOAuthButton,
  showDualConnectOptions,
  STANDARD_OAUTH_UNAVAILABLE_NOTE,
  STANDARD_STRIPE_DASHBOARD_URL,
  standardOAuthButtonLabel,
  STRIPE_CONNECT_RETURN_HINT,
  stripeConnectSectionDescription,
  type TStripeConnectUiStatus,
} from "@/lib/property-stripe-connect-utils";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  type IPropertyStripeConnectStatusResponse,
  PropertyStripeAccountType,
} from "@/packages/shared";

type TStripeConnectSwitchTarget = "express" | "standard";

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

type TConnectViewSharedProps = {
  connectPending: boolean;
  expressPending: boolean;
  onExpressClick: () => void;
  onStandardOAuthClick: () => void;
  onSwitchToExpress: () => void;
  onSwitchToStandard: () => void;
  standardOAuthPending: boolean;
  status: IPropertyStripeConnectStatusResponse;
  uiStatus: TStripeConnectUiStatus;
};

const NotConnectedConnectView = memo(function NotConnectedConnectView({
  connectPending,
  expressPending,
  onExpressClick,
  onStandardOAuthClick,
  standardOAuthPending,
  status,
}: Omit<TConnectViewSharedProps, "onSwitchToExpress" | "onSwitchToStandard" | "uiStatus">) {
  const showStandard = shouldShowStandardOAuthButton(status);

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", showStandard ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
        <StripeConnectChoiceCard
          bullets={["Guided Stripe setup", "About 5–10 minutes"]}
          disabled={connectPending}
          icon={Sparkles}
          label={expressOnboardingButtonLabel("not_connected")}
          loadingLabel="Opening Stripe…"
          onClick={onExpressClick}
          pending={expressPending}
          title="I’m new to Stripe"
          variant="default"
        />
        {showStandard ? (
          <StripeConnectChoiceCard
            bullets={["Link your existing account", "Payouts stay in your Stripe"]}
            disabled={connectPending}
            icon={Link2}
            label={standardOAuthButtonLabel("not_connected")}
            loadingLabel="Redirecting to Stripe…"
            onClick={onStandardOAuthClick}
            pending={standardOAuthPending}
            title="I already have Stripe"
            variant="outline"
          />
        ) : null}
      </div>
      {!showStandard ? (
        <p className="text-muted-foreground text-sm">{STANDARD_OAUTH_UNAVAILABLE_NOTE}</p>
      ) : null}
      {connectPending ? (
        <p className="text-muted-foreground text-sm">{STRIPE_CONNECT_RETURN_HINT}</p>
      ) : null}
    </div>
  );
});
NotConnectedConnectView.displayName = "NotConnectedConnectView";

const IncompleteConnectView = memo(function IncompleteConnectView({
  connectPending,
  expressPending,
  onExpressClick,
  onStandardOAuthClick,
  onSwitchToExpress,
  onSwitchToStandard,
  standardOAuthPending,
  status,
  uiStatus,
}: TConnectViewSharedProps) {
  const canSwitch = showDualConnectOptions(status);
  const isExpress = status.accountType === PropertyStripeAccountType.EXPRESS;
  const isStandard = status.accountType === PropertyStripeAccountType.STANDARD;
  const primaryPending = isExpress ? expressPending : standardOAuthPending;
  const primaryLabel = isExpress
    ? expressOnboardingButtonLabel(uiStatus, status.accountType)
    : standardOAuthButtonLabel(uiStatus, status.accountType);
  const primaryLoadingLabel = isExpress ? "Opening Stripe…" : "Redirecting to Stripe…";
  const onPrimaryClick = isExpress ? onExpressClick : onStandardOAuthClick;

  return (
    <div className="space-y-4">
      <StripeConnectProgressSteps />
      <div className="space-y-2">
        <Button disabled={connectPending} onClick={onPrimaryClick} type="button">
          {primaryPending ? primaryLoadingLabel : primaryLabel}
        </Button>
        {connectPending ? (
          <p className="text-muted-foreground text-sm">{STRIPE_CONNECT_RETURN_HINT}</p>
        ) : null}
      </div>
      {canSwitch ? (
        <Button
          className="h-auto px-0 text-sm"
          disabled={connectPending}
          onClick={isExpress ? onSwitchToStandard : onSwitchToExpress}
          type="button"
          variant="link"
        >
          Use a different connection method
        </Button>
      ) : null}
      {isStandard && !canSwitch ? (
        <p className="text-muted-foreground text-sm">
          Complete any remaining requirements in Stripe Dashboard, then return here.
        </p>
      ) : null}
      <StripeConnectTechnicalDetails status={status} />
    </div>
  );
});
IncompleteConnectView.displayName = "IncompleteConnectView";

const ReadyConnectView = memo(function ReadyConnectView({
  connectPending,
  expressPending,
  onExpressClick,
  status,
}: Pick<
  TConnectViewSharedProps,
  "connectPending" | "expressPending" | "onExpressClick" | "status"
>) {
  const showDashboard = shouldShowStandardDashboardLink(status);
  const showExpressUpdate = status.accountType === PropertyStripeAccountType.EXPRESS;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="bg-background text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium leading-snug">Rent payments are live</p>
          <p className="text-muted-foreground text-sm">
            Tenants can pay from their portal; funds settle to your Stripe account.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {showExpressUpdate ? (
          <Button
            disabled={connectPending}
            onClick={onExpressClick}
            type="button"
            variant="outline"
          >
            {expressPending ? "Opening Stripe…" : "Update Stripe details"}
          </Button>
        ) : null}
        {showDashboard ? <StripeConnectDashboardButton /> : null}
      </div>
      {expressPending ? (
        <p className="text-muted-foreground text-sm">{STRIPE_CONNECT_RETURN_HINT}</p>
      ) : null}
      <StripeConnectTechnicalDetails status={status} />
    </div>
  );
});
ReadyConnectView.displayName = "ReadyConnectView";

export const PropertyStripeConnectSection = memo(function PropertyStripeConnectSection({
  propertyId,
  status,
}: {
  propertyId: string;
  status: IPropertyStripeConnectStatusResponse;
}) {
  const [switchTarget, setSwitchTarget] = useState<TStripeConnectSwitchTarget | null>(null);
  const { connectPending, expressOnboardingMutation, standardOAuthMutation } =
    usePropertyStripeConnectMutations(propertyId);

  const uiStatus = getStripeConnectUiStatus(status);

  const runExpressConnect = () => {
    expressOnboardingMutation.mutate();
  };

  const runStandardConnect = () => {
    standardOAuthMutation.mutate();
  };

  const handleExpressClick = () => {
    if (isStripeConnectTypeSwitch(status, "express")) {
      setSwitchTarget("express");
      return;
    }
    runExpressConnect();
  };

  const handleStandardOAuthClick = () => {
    if (isStripeConnectTypeSwitch(status, "standard")) {
      setSwitchTarget("standard");
      return;
    }
    runStandardConnect();
  };

  const handleSwitchToExpress = () => {
    setSwitchTarget("express");
  };

  const handleSwitchToStandard = () => {
    setSwitchTarget("standard");
  };

  const handleConfirmSwitch = () => {
    if (switchTarget === "express") {
      runExpressConnect();
    } else if (switchTarget === "standard") {
      runStandardConnect();
    }
    setSwitchTarget(null);
  };

  return (
    <Card
      className={cn(
        "border-border/80 bg-card/80 border-l-4 shadow-sm backdrop-blur-sm",
        uiStatus === "ready" && "border-l-emerald-600/70",
        uiStatus === "setup_incomplete" && "border-l-primary",
        uiStatus === "not_connected" && "border-l-transparent"
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Wallet className="text-muted-foreground size-4" />
          <CardTitle className="text-lg">Online rent payments</CardTitle>
          <PropertyStripeConnectStatusBadge status={status} />
        </div>
        <CardDescription>{stripeConnectSectionDescription(status, uiStatus)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {uiStatus === "not_connected" ? (
          <NotConnectedConnectView
            connectPending={connectPending}
            expressPending={expressOnboardingMutation.isPending}
            onExpressClick={handleExpressClick}
            onStandardOAuthClick={handleStandardOAuthClick}
            standardOAuthPending={standardOAuthMutation.isPending}
            status={status}
          />
        ) : null}
        {uiStatus === "setup_incomplete" ? (
          <IncompleteConnectView
            connectPending={connectPending}
            expressPending={expressOnboardingMutation.isPending}
            onExpressClick={handleExpressClick}
            onStandardOAuthClick={handleStandardOAuthClick}
            onSwitchToExpress={handleSwitchToExpress}
            onSwitchToStandard={handleSwitchToStandard}
            standardOAuthPending={standardOAuthMutation.isPending}
            status={status}
            uiStatus={uiStatus}
          />
        ) : null}
        {uiStatus === "ready" ? (
          <ReadyConnectView
            connectPending={connectPending}
            expressPending={expressOnboardingMutation.isPending}
            onExpressClick={handleExpressClick}
            status={status}
          />
        ) : null}
      </CardContent>
      <DeleteConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Switch"
        confirmVariant="default"
        description="Your incomplete Stripe setup will be discarded and you'll start connecting a different way."
        isPending={connectPending}
        onConfirm={handleConfirmSwitch}
        onOpenChange={(open) => {
          if (!open) {
            setSwitchTarget(null);
          }
        }}
        open={switchTarget !== null}
        title="Switch connection method?"
      />
    </Card>
  );
});
PropertyStripeConnectSection.displayName = "PropertyStripeConnectSection";
