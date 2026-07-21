import { Sparkles } from "lucide-react";
import { memo, useCallback, useState, useSyncExternalStore } from "react";

import { WhatsChangedDialog } from "@/components/layout/whats-changed-dialog";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { LATEST_RELEASE_ID } from "@/config/release-notes";
import {
  markReleaseNotesSeen,
  readLastSeenReleaseId,
  subscribeSeenRelease,
} from "@/lib/release-notes-preference";

const SidebarWhatsChangedInner = memo(() => {
  const [open, setOpen] = useState(false);
  const lastSeenReleaseId = useSyncExternalStore(
    subscribeSeenRelease,
    readLastSeenReleaseId,
    () => null
  );
  const hasUnread = LATEST_RELEASE_ID !== null && lastSeenReleaseId !== LATEST_RELEASE_ID;

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      markReleaseNotesSeen();
    }
  }, []);

  return (
    <>
      <SidebarMenu className="pb-2">
        <SidebarMenuItem>
          <SidebarMenuButton
            className="relative"
            onClick={() => handleOpenChange(true)}
            tooltip="What's changed"
            type="button"
          >
            <Sparkles className="size-4" />
            <span className="min-w-0 truncate">What&apos;s changed</span>
            {hasUnread ? (
              <div
                aria-label="Unread updates"
                className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-sidebar group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1"
                role="img"
              />
            ) : null}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <WhatsChangedDialog onOpenChange={handleOpenChange} open={open} />
    </>
  );
});
SidebarWhatsChangedInner.displayName = "SidebarWhatsChangedInner";

export const SidebarWhatsChanged = SidebarWhatsChangedInner;
