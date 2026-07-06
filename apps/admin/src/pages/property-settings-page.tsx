import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { useParams } from "react-router-dom";

import { PropertyPageShell } from "@/components/properties/property-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertySettingsForm } from "@/hooks/use-property-settings-form";
import { propertiesApi, settingsApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { type IPropertySettings,PropertyRole, UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const PropertySettingsEditor = memo(
  ({
    canEdit,
    propertyId,
    propertyName,
    settings,
  }: {
    canEdit: boolean;
    propertyId: string;
    propertyName: string;
    settings: IPropertySettings;
  }) => {
    const { formContent, headerActions } = usePropertySettingsForm({
      canEdit,
      propertyId,
      settings,
    });

    return (
      <PropertyPageShell
        actions={headerActions}
        propertyId={propertyId}
        propertyName={propertyName}
      >
        {formContent}
      </PropertyPageShell>
    );
  }
);
PropertySettingsEditor.displayName = "PropertySettingsEditor";

const PropertySettingsContent = memo(
  ({ propertyId, propertyName }: { propertyId: string; propertyName: string }) => {
    const currentUser = useAuthStore((s) => s.user);

    const settingsQuery = useQuery({
      queryFn: () => settingsApi.get(propertyId),
      queryKey: adminQueryKeys.propertySettings(propertyId),
    });

    const propertyDetailQuery = useQuery({
      queryFn: () => propertiesApi.getDetail(propertyId),
      queryKey: adminQueryKeys.propertyDetail(propertyId),
    });

    const isAdmin = currentUser?.userType === UserType.ADMIN;
    const members = propertyDetailQuery.data?.property?.members ?? [];
    const callerMembership = members.find((m) => m.userId === currentUser?.id);
    const isCreator = propertyDetailQuery.data?.property?.createdBy === currentUser?.id;
    const canEdit = isAdmin || isCreator || callerMembership?.role === PropertyRole.OWNER;

    if (settingsQuery.isPending) {
      return (
        <PropertyPageShell propertyId={propertyId} propertyName={propertyName}>
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </PropertyPageShell>
      );
    }

    if (settingsQuery.isError || !settingsQuery.data?.settings) {
      return (
        <PropertyPageShell propertyId={propertyId} propertyName={propertyName}>
          <p className="text-destructive text-sm">
            {settingsQuery.error instanceof Error
              ? settingsQuery.error.message
              : "Failed to load settings"}
          </p>
        </PropertyPageShell>
      );
    }

    return (
      <PropertySettingsEditor
        canEdit={canEdit}
        propertyId={propertyId}
        propertyName={propertyName}
        settings={settingsQuery.data.settings}
      />
    );
  }
);
PropertySettingsContent.displayName = "PropertySettingsContent";

const PropertySettingsPageInner = memo(() => {
  const { propertyId } = useParams<{ propertyId: string }>();

  const propertyQuery = useQuery({
    enabled: Boolean(propertyId),
    queryFn: () => propertiesApi.getDetail(propertyId!), // NOSONAR
    queryKey: adminQueryKeys.propertyDetail(propertyId!), // NOSONAR
  });

  if (!propertyId) {
    return <p className="text-muted-foreground text-sm">Invalid property.</p>;
  }

  if (propertyQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (propertyQuery.isError || !propertyQuery.data?.property) {
    return (
      <p className="text-destructive text-sm">
        {propertyQuery.error instanceof Error
          ? propertyQuery.error.message
          : "Property not found"}
      </p>
    );
  }

  return (
    <PropertySettingsContent
      key={propertyId}
      propertyId={propertyId}
      propertyName={propertyQuery.data.property.name}
    />
  );
});
PropertySettingsPageInner.displayName = "PropertySettingsPageInner";

export const PropertySettingsPage = PropertySettingsPageInner;
