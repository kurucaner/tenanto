import { type IPropertyShellTab,PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";
import { type IPropertyPermissions } from "@/hooks/use-property-permissions";

import { isTenantEmailCampaignsUiEnabled } from "./tenant-email-campaigns-feature";

export function getVisiblePropertyShellTabs(
  permissions: IPropertyPermissions
): IPropertyShellTab[] {
  return PROPERTY_SHELL_TABS.filter((tab) => {
    if (tab.path === "communications") {
      return isTenantEmailCampaignsUiEnabled() && permissions.canSendTenantNotifications;
    }
    return true;
  });
}
