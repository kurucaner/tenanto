import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { PropertyStripeConnectSection } from "@/components/settings/property-stripe-connect-section";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertySettingsForm } from "@/hooks/use-property-settings-form";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { propertyStripeConnectApi, settingsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { type IPropertySettings } from "@/packages/shared";

const PropertySettingsForm = memo(
  ({
    canEdit,
    propertyId,
    settings,
  }: {
    canEdit: boolean;
    propertyId: string;
    settings: IPropertySettings;
  }) => {
    const { formContent, headerActions } = usePropertySettingsForm({
      canEdit,
      propertyId,
      settings,
    });

    usePropertyShellActions(headerActions);

    return formContent;
  }
);
PropertySettingsForm.displayName = "PropertySettingsForm";

export const PropertySettingsPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canEdit = permissions.canManageStructure;
  const canManageStripeConnect = permissions.canManageStripeConnect;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: queryKeys.propertySettings(propertyId),
  });

  const stripeConnectStatusQuery = useQuery({
    enabled: canManageStripeConnect,
    queryFn: () => propertyStripeConnectApi.getStatus(propertyId),
    queryKey: queryKeys.propertyStripeConnectStatus(propertyId),
  });

  const showStripeConnectSection =
    canManageStripeConnect && stripeConnectStatusQuery.data?.platformEnabled === true;

  useEffect(() => {
    if (!canManageStripeConnect) {
      return;
    }

    if (stripeConnectStatusQuery.data?.platformEnabled === false) {
      return;
    }

    const stripeConnect = searchParams.get("stripe_connect");
    if (stripeConnect !== "return" && stripeConnect !== "refresh") {
      return;
    }

    queryClient.invalidateQueries({
      queryKey: queryKeys.propertyStripeConnectStatus(propertyId),
    });

    if (stripeConnect === "return") {
      toast.success("Stripe Connect updated", {
        description: "Refreshing account status from Stripe.",
      });
    } else {
      toast.message("Stripe onboarding incomplete", {
        description: "Continue setup when you’re ready.",
      });
    }

    const next = new URLSearchParams(searchParams);
    next.delete("stripe_connect");
    setSearchParams(next, { replace: true });
  }, [
    canManageStripeConnect,
    propertyId,
    queryClient,
    searchParams,
    setSearchParams,
    stripeConnectStatusQuery.data?.platformEnabled,
  ]);

  if (settingsQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data?.settings) {
    return (
      <p className="text-destructive text-sm">
        {settingsQuery.error instanceof Error
          ? settingsQuery.error.message
          : "Failed to load settings"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {showStripeConnectSection ? (
        <PropertyStripeConnectSection propertyId={propertyId} />
      ) : null}
      <PropertySettingsForm
        canEdit={canEdit}
        propertyId={propertyId}
        settings={settingsQuery.data.settings}
      />
    </div>
  );
});
PropertySettingsPage.displayName = "PropertySettingsPage";
