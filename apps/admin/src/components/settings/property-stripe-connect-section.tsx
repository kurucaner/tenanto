import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";

import { PropertyStripeConnectStatusBadge } from "@/components/settings/property-stripe-connect-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { propertyStripeConnectApi } from "@/lib/api-client";
import { getStripeConnectUiStatus } from "@/lib/property-stripe-connect-utils";
import { queryKeys } from "@/lib/query-keys";

function openStripeOnboardingUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function onboardingButtonLabel(uiStatus: ReturnType<typeof getStripeConnectUiStatus>): string {
  switch (uiStatus) {
    case "ready":
      return "Update Stripe details";
    case "setup_incomplete":
      return "Continue setup";
    case "not_connected":
    default:
      return "Connect with Stripe";
  }
}

function connectDescription(uiStatus: ReturnType<typeof getStripeConnectUiStatus>): string {
  switch (uiStatus) {
    case "ready":
      return "Tenants can pay rent to this property. Funds settle to the connected Stripe account after checkout.";
    case "setup_incomplete":
      return "Stripe Connect is started but not fully enabled for charges yet. Continue setup so tenants can pay rent.";
    case "not_connected":
    default:
      return "Connect a Stripe Express account so tenants can pay rent to this property. Funds settle to the connected account after checkout.";
  }
}

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

  const onboardingMutation = useMutation({
    mutationFn: () => propertyStripeConnectApi.createOnboardingLink(propertyId),
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

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CreditCard className="text-muted-foreground size-4" />
          <CardTitle className="text-lg">Rent payments (Stripe)</CardTitle>
          <PropertyStripeConnectStatusBadge status={status} />
        </div>
        <CardDescription>{connectDescription(uiStatus)}</CardDescription>
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

        <Button
          disabled={onboardingMutation.isPending}
          onClick={() => onboardingMutation.mutate()}
          type="button"
        >
          {onboardingMutation.isPending ? "Opening Stripe…" : onboardingButtonLabel(uiStatus)}
        </Button>
      </CardContent>
    </Card>
  );
});
PropertyStripeConnectSection.displayName = "PropertyStripeConnectSection";
