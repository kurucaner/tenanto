import { useQuery } from "@tanstack/react-query";
import { memo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { usePropertySettingsForm } from "@/hooks/use-property-settings-form";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { settingsApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
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

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: adminQueryKeys.propertySettings(propertyId),
  });

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
    <PropertySettingsForm
      canEdit={canEdit}
      propertyId={propertyId}
      settings={settingsQuery.data.settings}
    />
  );
});
PropertySettingsPage.displayName = "PropertySettingsPage";
